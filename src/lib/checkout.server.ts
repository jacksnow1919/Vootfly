/**
 * Online card checkout, ticketed by the sales team — SERVER ONLY.
 *
 * The order of events is the whole point of this file:
 *   1. The amount comes from a fresh supplier check, never from the browser.
 *   2. The customer's card is HELD through Stripe (manual capture), not charged.
 *   3. finalizeCheckout asks Stripe directly whether the hold is real. The browser saying
 *      "paid" counts for nothing. A real hold puts the booking in the sales team's queue.
 *   4. The team issues the ticket outside this site and enters the PNR in admin.
 *   5. Only then does "Charge card" take the money. "Release hold" frees it instead.
 *
 * Nothing here buys a ticket by itself. A hold lasts about 7 days (Stripe gives the exact
 * date per charge), so admin shows when each one runs out.
 *
 * Duplicates: the browser and the Stripe webhook can both call finalizeCheckout, and staff
 * can double-click. Whichever claims the row first (a single conditional update) does the
 * work; the others just read the result. Stripe calls also carry idempotency keys.
 */
import type { Database, Json } from "@/integrations/supabase/types";
import { duffelIsTestMode } from "./fare-provider.server";
import { getDuffelOffer, type TripSegment, type TripSnapshot } from "./duffel.server";
import type { FareSupplier, PkfareNormalisedFare, PkfareSearchQuery } from "./pkfare-types";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  createPaymentIntent,
  holdExpiresAt,
  maskedCard,
  refundPaymentIntent,
  retrievePaymentIntent,
  StripeError,
  stripeIsTestMode,
  stripeKeys,
  toMinorUnits,
  type StripePaymentIntent,
} from "./stripe.server";
import type { BookingStatus, CheckoutView, FareRef, PaymentStatus, PublicQuote, QuoteResult, StartCheckoutResult } from "./checkout-shared";

type CheckoutRow = Database["public"]["Tables"]["checkouts"]["Row"];
type CheckoutUpdate = Database["public"]["Tables"]["checkouts"]["Update"];

export type StoredTraveller = {
  title: string;
  gender: string;
  firstName: string;
  lastName: string;
  bornOn?: string;
  passportNo?: string;
  passportExpiry?: string;
  nationality?: string;
};
export type StoredContact = {
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

const SUPPORT_PHONE = "+1-800-773-6613";
/** A charge that started this long ago and never saved a result means the request died. */
const STUCK_AFTER_MS = 3 * 60_000;

const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export async function loadCheckout(id: string): Promise<CheckoutRow | null> {
  const { data, error } = await (await db()).from("checkouts").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[checkout] read failed", error);
    throw new Error("CHECKOUT_READ_FAILED");
  }
  return data;
}

async function patch(id: string, values: CheckoutUpdate): Promise<CheckoutRow> {
  const { data, error } = await (await db())
    .from("checkouts")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    console.error("[checkout] update failed", id, values.booking_status, error);
    throw new Error("CHECKOUT_UPDATE_FAILED");
  }
  return data;
}

/** One step forward only if the row is still where this caller expects. Null means someone else moved it. */
async function claim(id: string, from: BookingStatus, values: CheckoutUpdate): Promise<CheckoutRow | null> {
  const { data, error } = await (await db())
    .from("checkouts")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("booking_status", from)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[checkout] claim failed", id, error);
    throw new Error("CHECKOUT_UPDATE_FAILED");
  }
  return data;
}

/** Card checkout is on only with Stripe keys present, and never takes real money for a test airline. */
const paymentsOn = () => Boolean(stripeKeys()) && (stripeIsTestMode() || !duffelIsTestMode());

/* ---------------------------------- fares --------------------------------- */

type ServerQuote = PublicQuote & { fareKey: string; supplier: FareSupplier };
type ServerQuoteResult = { ok: true; quote: ServerQuote } | { ok: false; reason: "unavailable" | "check_failed" };

const CABINS: Record<string, PkfareSearchQuery["cabinClass"]> = {
  economy: "Economy",
  "premium economy": "PremiumEconomy",
  premiumeconomy: "PremiumEconomy",
  business: "Business",
  first: "First",
};
const flightKey = (flightNo: string) => flightNo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
const twoDecimals = (n: number) => n.toFixed(2);

function tripSegments(fare: { airline: string; flightNo: string; origin: string; destination: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string; segments?: PkfareNormalisedFare["segments"] }): TripSegment[] {
  if (fare.segments?.length) {
    return fare.segments.map((s) => ({
      carrier: s.carrier_name && s.carrier_name !== s.carrier ? s.carrier_name : "",
      flightNo: s.flight_number ?? s.carrier,
      origin: s.origin,
      destination: s.destination,
      departAt: s.departure_time ?? "",
      arriveAt: s.arrival_time ?? "",
    }));
  }
  return [
    {
      carrier: fare.airline,
      flightNo: fare.flightNo,
      origin: fare.origin,
      destination: fare.destination,
      departAt: `${fare.departDate} ${fare.departTime}`,
      arriveAt: `${fare.arriveDate} ${fare.arriveTime}`,
    },
  ];
}

/** Only what the supplier sent for this fare. Anything it left out stays null, never guessed. */
function tripFromFare(f: PkfareNormalisedFare): TripSnapshot {
  const slice = (leg: Parameters<typeof tripSegments>[0] & { duration: string; stops: number }, cabin: string | null) => {
    const segments = tripSegments(leg);
    return {
      origin: leg.origin,
      destination: leg.destination,
      departAt: segments[0]?.departAt || `${leg.departDate} ${leg.departTime}`,
      arriveAt: segments.at(-1)?.arriveAt || `${leg.arriveDate} ${leg.arriveTime}`,
      duration: leg.duration,
      stops: leg.stops,
      cabin,
      segments,
    };
  };
  const stated = (allowed: boolean | undefined) => ({ allowed: allowed ?? null, penalty: null });
  return {
    airline: f.airline,
    slices: [slice(f, f.cabin), ...(f.returnFlight ? [slice(f.returnFlight, f.cabin)] : [])],
    cabinBags: f.terms?.baggage?.cabin_bags ?? null,
    checkedBags: f.terms?.baggage?.checked_bags ?? null,
    refund: stated(f.terms?.refundable),
    change: stated(f.terms?.changeable),
  };
}

/**
 * Suppliers with no "read this exact offer" call get a fresh search, narrowed to the flight
 * the customer chose. The browser's price only picks between several fares on that flight,
 * so a changed URL can never lower what is charged: an unmatched price gets the real fare.
 */
async function quoteFromSearch(ref: FareRef): Promise<ServerQuoteResult> {
  if (!ref.supplier) return { ok: false, reason: "unavailable" };
  let fares: PkfareNormalisedFare[];
  try {
    const { runPkfareSearch } = await import("./pkfare.server");
    fares = await runPkfareSearch({
      origin: ref.origin,
      destination: ref.destination,
      departDate: ref.departDate,
      returnDate: ref.returnDate,
      adults: ref.passengers,
      cabinClass: CABINS[ref.cabin.trim().toLowerCase()] ?? "Economy",
      currency: ref.currency,
      supplier: ref.supplier,
      solutions: 50,
    });
  } catch (e) {
    console.error("[checkout] fare check failed", ref.supplier, e);
    return { ok: false, reason: "check_failed" };
  }
  const sameFlight = fares.filter((f) => flightKey(f.flightNo) === flightKey(ref.flightNo));
  if (sameFlight.length === 0) return { ok: false, reason: "unavailable" };
  const shown = Number(ref.price);
  const fare =
    sameFlight.find((f) => Math.abs(f.price - shown) < 0.01) ?? [...sameFlight].sort((a, z) => a.price - z.price)[0]!;
  return {
    ok: true,
    quote: {
      fareKey: fare.id,
      supplier: ref.supplier,
      total: twoDecimals(fare.totalPrice ?? fare.price * ref.passengers),
      currency: fare.currency,
      base: null,
      tax: null,
      trip: tripFromFare(fare),
    },
  };
}

async function readQuote(ref: FareRef): Promise<ServerQuoteResult> {
  if (!ref.offerId) return quoteFromSearch(ref);
  const offer = await getDuffelOffer(ref.offerId);
  if (!offer.ok) return offer;
  const q = offer.quote;
  if (q.passengerIds.length !== ref.passengers) return { ok: false, reason: "unavailable" };
  return { ok: true, quote: { fareKey: q.offerId, supplier: "duffel", total: q.total, currency: q.currency, base: q.base, tax: q.tax, trip: q.trip } };
}

const publicQuote = ({ total, currency, base, tax, trip }: ServerQuote): PublicQuote => ({ total, currency, base, tax, trip });

export async function quoteFare(ref: FareRef): Promise<QuoteResult> {
  if (!paymentsOn()) return { status: "payments_off" };
  const result = await readQuote(ref);
  return result.ok ? { status: "ok", quote: publicQuote(result.quote) } : { status: result.reason };
}

function newReference(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `VF${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

/* ---------------------------------- hold ---------------------------------- */

export async function startCheckout(input: {
  fare: FareRef;
  /** The total the customer saw on the review page. Only used to spot a change, never charged. */
  expectedTotal: string;
  travellers: StoredTraveller[];
  contact: StoredContact;
  utmSource: string;
  clickId: string;
  userId: string | null;
}): Promise<StartCheckoutResult> {
  if (!paymentsOn()) return { status: "payments_off" };
  if (input.fare.passengers !== input.travellers.length) {
    return { status: "invalid", message: `This fare is for ${input.fare.passengers} traveller(s). Please search again if your party has changed.` };
  }

  const result = await readQuote(input.fare);
  if (!result.ok) return { status: result.reason };
  const quote = result.quote;
  if (quote.total !== input.expectedTotal) return { status: "price_changed", quote: publicQuote(quote) };

  const amountMinor = toMinorUnits(quote.total, quote.currency);
  if (!amountMinor) {
    console.error("[checkout] amount cannot be charged exactly", quote.total, quote.currency);
    return { status: "failed" };
  }

  const reference = newReference();
  const { data: row, error } = await (await db())
    .from("checkouts")
    .insert({
      reference,
      test_mode: stripeIsTestMode(),
      supplier: quote.supplier,
      supplier_offer_id: quote.fareKey,
      currency: quote.currency,
      amount: quote.total,
      amount_minor: amountMinor,
      base_amount: quote.base,
      tax_amount: quote.tax,
      trip: quote.trip as unknown as Json,
      travellers: input.travellers as unknown as Json,
      contact: input.contact as unknown as Json,
      user_id: input.userId,
      utm_source: input.utmSource || null,
      click_id: input.clickId || null,
    })
    .select("*")
    .single();
  if (error || !row) {
    console.error("[checkout] insert failed", error);
    return { status: "failed" };
  }

  try {
    const intent = await createPaymentIntent({
      amountMinor,
      currency: quote.currency,
      description: `VootFly booking ${reference}`,
      receiptEmail: input.contact.email,
      checkoutId: row.id,
      reference,
    });
    await patch(row.id, { stripe_payment_intent_id: intent.id, booking_status: "awaiting_payment" });
  } catch (e) {
    console.error("[checkout] could not create the payment", e);
    await patch(row.id, { booking_status: "failed", payment_status: "failed", failure_code: "payment_setup_failed" }).catch(() => null);
    return { status: "failed" };
  }
  return { status: "ok", checkoutId: row.id };
}

/** Passport and birth details stay only until the ticket is settled; the names are all staff need after that. */
function withoutIdentity(row: CheckoutRow): Json {
  return (row.travellers as unknown as StoredTraveller[]).map(({ title, gender, firstName, lastName }) => ({
    title,
    gender,
    firstName,
    lastName,
  })) as unknown as Json;
}

/** A charge that started and never saved a result: the money may have moved, so staff must look. */
async function reviewIfStuck(row: CheckoutRow): Promise<CheckoutRow> {
  if (row.booking_status !== "payment_confirmed") return row;
  const claimedAt = row.claimed_at ? Date.parse(row.claimed_at) : 0;
  if (Date.now() - claimedAt < STUCK_AFTER_MS) return row;
  return (
    (await claim(row.id, "payment_confirmed", {
      booking_status: "manual_review",
      failure_code: "processing_interrupted",
      failure_detail: "A charge started but no result was saved. Check this payment in Stripe before doing anything else.",
    })) ?? row
  );
}

/**
 * Safe to call any number of times, from the browser or the webhook. Asks Stripe whether the
 * hold is real and, if it is, puts the booking in the sales team's queue. Charges nothing.
 */
export async function finalizeCheckout(id: string): Promise<CheckoutRow | null> {
  const row = await loadCheckout(id);
  if (!row || !row.stripe_payment_intent_id) return row;
  if (row.booking_status !== "awaiting_payment") return reviewIfStuck(row);

  const intent = await retrievePaymentIntent(row.stripe_payment_intent_id);
  if (intent.metadata?.["checkout_id"] !== row.id || intent.amount !== row.amount_minor || intent.currency !== row.currency.toLowerCase()) {
    console.error("[checkout] payment does not match checkout", row.id, intent.id);
    return patch(row.id, {
      booking_status: "manual_review",
      failure_code: "payment_mismatch",
      failure_detail: `Stripe shows ${intent.amount} ${intent.currency}, expected ${row.amount_minor} ${row.currency}.`,
    });
  }
  if (intent.status === "canceled") {
    return (await claim(row.id, "awaiting_payment", { booking_status: "cancelled", payment_status: "cancelled" })) ?? loadCheckout(id);
  }
  // Anything other than a real hold means the customer has not finished paying yet.
  if (intent.status !== "requires_capture") return row;

  const held = await claim(row.id, "awaiting_payment", {
    booking_status: "awaiting_ticket",
    payment_status: "authorized",
    claimed_at: new Date().toISOString(),
    hold_expires_at: holdExpiresAt(intent),
    failure_code: null,
    failure_detail: null,
    ...maskedCard(intent),
  });
  if (!held) return loadCheckout(id);
  return recordHeldBooking(held);
}

/**
 * Adds a held payment to All Bookings and alerts the advisors, like any booking request. Test
 * checkouts stay out, so they never reach the real list. A failure here can't undo the hold, so
 * it is logged and the Online payments tab shows that no booking row was created.
 */
async function recordHeldBooking(row: CheckoutRow): Promise<CheckoutRow> {
  if (row.test_mode) return row;

  const supabase = await db();
  const trip = row.trip as unknown as TripSnapshot;
  const travellers = row.travellers as unknown as StoredTraveller[];
  const contact = row.contact as unknown as StoredContact;
  const lead = travellers[0]!;
  const outbound = trip.slices[0];
  const inbound = trip.slices[1];
  const amount = Number(row.amount);

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      pnr: row.reference,
      user_id: row.user_id,
      source: (row.utm_source ?? "").trim().toLowerCase() || "direct",
      lead_name: `${lead.firstName} ${lead.lastName}`,
      guest_email: contact.email,
      guest_phone: contact.phone,
      billing_address: contact.address,
      billing_city: contact.city,
      billing_country: contact.country,
      billing_postal_code: contact.postalCode,
      origin: outbound?.origin ?? "",
      destination: outbound?.destination ?? "",
      airline: trip.airline,
      cabin_class: outbound?.cabin ?? null,
      depart_date: outbound?.departAt.slice(0, 10) || null,
      return_date: inbound?.departAt.slice(0, 10) || null,
      total_price: amount,
      currency: row.currency,
      utm_source: row.utm_source,
      click_id: row.click_id,
      verification_status: "pending_verification",
      capture_status: "not_applicable",
      gross_fare: amount,
      supplier_code: row.supplier,
      revalidation_status: "confirmed",
      revalidated_price: amount,
      revalidated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !booking) {
    console.error("[checkout] held payment could not be copied to bookings", row.id, error);
    return row;
  }

  const results = await Promise.all([
    supabase.from("passengers").insert(
      travellers.map((t) => ({
        booking_id: booking.id,
        title: t.title,
        first_name: t.firstName,
        last_name: t.lastName,
        gender: t.gender,
        passport_no: t.passportNo ?? null,
        dob: t.bornOn ?? null,
      })),
    ),
    supabase.from("payments").insert({
      booking_id: booking.id,
      amount,
      currency: row.currency,
      method: "card",
      transaction_ref: row.stripe_payment_intent_id,
      status: "pending_auth",
    }),
  ]);
  for (const r of results) if (r.error) console.error("[checkout] booking detail insert failed", row.id, r.error);

  const { notifyBookingCreated } = await import("./bookings.functions");
  await notifyBookingCreated().catch(() => undefined);
  return patch(row.id, { booking_id: booking.id });
}

/* ------------------------------ staff actions ----------------------------- */

export type StaffActionResult =
  | { ok: true; reference: string; amount: string; currency: string; bookingId: string | null }
  | { ok: false; message: string };

const done = (row: CheckoutRow): StaffActionResult => ({
  ok: true,
  reference: row.reference,
  amount: row.amount,
  currency: row.currency,
  bookingId: row.booking_id,
});

/** The hold ran out or was cancelled in Stripe, so there is nothing left to charge. */
async function closeHold(row: CheckoutRow, code: string, detail: string): Promise<CheckoutRow> {
  const closed = await patch(row.id, {
    booking_status: "cancelled",
    payment_status: "cancelled",
    failure_code: code,
    failure_detail: detail,
    travellers: withoutIdentity(row),
  });
  if (closed.booking_id) {
    const supabase = await db();
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", closed.booking_id);
    await supabase.from("payments").update({ status: "cancelled" }).eq("booking_id", closed.booking_id);
  }
  return closed;
}

/**
 * Takes the money for a held card, after the team has issued the ticket. The PNR is required
 * so a customer is never charged for a booking with no airline reference on record.
 */
export async function chargeHeldCheckout(id: string, input: { pnr: string; ticketNumbers: string[]; operatorName: string }): Promise<StaffActionResult> {
  const row = await claim(id, "awaiting_ticket", { booking_status: "payment_confirmed", claimed_at: new Date().toISOString(), failure_code: null, failure_detail: null });
  if (!row) return { ok: false, message: "This payment is no longer waiting to be charged. Reload the page." };
  const intentId = row.stripe_payment_intent_id!;

  try {
    await capturePaymentIntent(intentId);
  } catch (e) {
    console.error("[checkout] capture failed", id, e);
    let intent: StripePaymentIntent | null = null;
    try {
      intent = await retrievePaymentIntent(intentId);
    } catch (readError) {
      console.error("[checkout] could not read the payment after a failed capture", id, readError);
    }
    if (intent?.status === "canceled") {
      await closeHold(row, "hold_expired", "The hold ended before the charge. The customer was not charged.");
      return { ok: false, message: "The hold on this card has ended, so it can't be charged. The customer has not been charged." };
    }
    if (intent?.status === "requires_capture") {
      await patch(id, { booking_status: "awaiting_ticket" });
      return { ok: false, message: `Stripe did not charge this card: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (intent?.status !== "succeeded") {
      await patch(id, {
        booking_status: "manual_review",
        failure_code: "capture_unknown",
        failure_detail: "The charge didn't report a result. Check this payment in Stripe before doing anything else.",
      });
      return { ok: false, message: "We couldn't tell whether the charge went through. Check this payment in Stripe before trying anything else." };
    }
    // The charge had already gone through (a retry): carry on and record it.
  }

  const now = new Date().toISOString();
  const charged = await patch(id, {
    booking_status: "confirmed",
    payment_status: "paid",
    paid_at: now,
    supplier_pnr: input.pnr,
    ticket_numbers: input.ticketNumbers,
    travellers: withoutIdentity(row),
  });

  if (charged.booking_id) {
    const supabase = await db();
    const results = await Promise.all([
      supabase
        .from("bookings")
        .update({
          status: input.ticketNumbers.length ? "issued" : "confirmed",
          verification_status: "verified",
          verified_by_name: input.operatorName,
          verified_at: now,
          capture_status: "captured",
          captured_at: now,
        })
        .eq("id", charged.booking_id),
      supabase.from("payments").update({ status: "captured" }).eq("booking_id", charged.booking_id),
      supabase.from("tickets").insert(
        (input.ticketNumbers.length ? input.ticketNumbers : [null]).map((ticket_number) => ({
          booking_id: charged.booking_id!,
          ticket_number,
          supplier: charged.supplier,
          pnr_code: input.pnr,
        })),
      ),
    ]);
    for (const r of results) if (r.error) console.error("[checkout] booking update after charge failed", id, r.error);

    if (charged.click_id) {
      const trip = charged.trip as unknown as TripSnapshot;
      const outbound = trip.slices[0];
      const { notifyEazairWebhook } = await import("./eazair.functions");
      await notifyEazairWebhook({
        data: {
          clickId: charged.click_id,
          pnr: charged.reference,
          amount: Number(charged.amount),
          currency: charged.currency,
          route: `${outbound?.origin ?? ""}-${outbound?.destination ?? ""}`,
        },
      }).catch(() => undefined);
    }
  }
  return done(charged);
}

/** Frees a held card when the ticket can't be issued. The customer is not charged. */
export async function releaseHeldCheckout(id: string, reason: string): Promise<StaffActionResult> {
  const row = await claim(id, "awaiting_ticket", { booking_status: "payment_confirmed", claimed_at: new Date().toISOString() });
  if (!row) return { ok: false, message: "This payment is no longer on hold. Reload the page." };
  try {
    await cancelPaymentIntent(row.stripe_payment_intent_id!);
  } catch (e) {
    console.error("[checkout] could not release the hold", id, e);
    await patch(id, { booking_status: "awaiting_ticket" });
    return { ok: false, message: `Stripe did not release this hold: ${e instanceof Error ? e.message : String(e)}` };
  }
  return done(await closeHold(row, "released_by_staff", reason));
}

async function markRefunded(intentId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase
    .from("checkouts")
    .update({ payment_status: "refunded", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", intentId);
  if (error) throw error;
  await supabase.from("payments").update({ status: "refunded" }).eq("transaction_ref", intentId);
}

/** Staff refund of a charged card. Moves money only, so the airline ticket must be cancelled separately. */
export async function refundCheckout(id: string): Promise<StaffActionResult> {
  const row = await loadCheckout(id);
  if (!row?.stripe_payment_intent_id) return { ok: false, message: "This checkout has no card payment." };
  if (row.payment_status !== "paid") return { ok: false, message: "Only a charged payment can be refunded." };
  try {
    await refundPaymentIntent(row.stripe_payment_intent_id);
  } catch (e) {
    if (!(e instanceof StripeError)) throw e;
    if (e.code !== "charge_already_refunded") return { ok: false, message: `Stripe did not refund this payment: ${e.message}` };
  }
  await markRefunded(row.stripe_payment_intent_id);
  return done(row);
}

/** The customer backed out of the payment page. Nothing was charged, and any hold is released. */
export async function cancelCheckout(id: string): Promise<CheckoutRow | null> {
  const cancelled = await claim(id, "awaiting_payment", {
    booking_status: "cancelled",
    payment_status: "cancelled",
  });
  if (!cancelled) return loadCheckout(id);
  if (cancelled.stripe_payment_intent_id) {
    await cancelPaymentIntent(cancelled.stripe_payment_intent_id).catch((e) => console.error("[checkout] cancel failed", id, e));
  }
  return patch(id, { travellers: withoutIdentity(cancelled) });
}

/* ------------------------------ customer view ----------------------------- */

function customerMessage(row: CheckoutRow, intent: StripePaymentIntent | null): string | null {
  switch (row.booking_status) {
    case "awaiting_payment":
      // A declined card leaves the checkout open: the customer can try again on the same page.
      return intent?.last_payment_error?.message ?? null;
    case "failed":
      return "We couldn't start this payment. You have not been charged. Please try again.";
    case "manual_review":
      return `This booking isn't confirmed yet because it needs a check by our team. Please don't try to pay again. We'll contact you, or you can call ${SUPPORT_PHONE} and quote ${row.reference}.`;
    case "cancelled":
      if (row.failure_code === "released_by_staff") {
        return `We couldn't issue this ticket, so nothing was booked. You have not been charged, and the hold on your card has been released. Your bank may take a few days to remove it. Please call ${SUPPORT_PHONE} if you'd like help finding another fare.`;
      }
      if (row.failure_code === "hold_expired") {
        return `This booking wasn't completed in time, so the hold on your card has ended and you have not been charged. Please call ${SUPPORT_PHONE} and quote ${row.reference}.`;
      }
      return "You cancelled this payment. Nothing was booked and you have not been charged.";
    default:
      return null;
  }
}

export async function checkoutView(id: string): Promise<CheckoutView | null> {
  const loaded = await loadCheckout(id);
  if (!loaded) return null;
  const row = await reviewIfStuck(loaded);

  const keys = stripeKeys();
  let intent: StripePaymentIntent | null = null;
  if (row.booking_status === "awaiting_payment" && row.stripe_payment_intent_id && keys) {
    intent = await retrievePaymentIntent(row.stripe_payment_intent_id);
  }
  const contact = row.contact as unknown as StoredContact;
  const open = row.booking_status === "awaiting_payment";

  return {
    id: row.id,
    reference: row.reference,
    testMode: row.test_mode,
    paymentStatus: row.payment_status as PaymentStatus,
    bookingStatus: row.booking_status as BookingStatus,
    currency: row.currency,
    amount: row.amount,
    baseAmount: row.base_amount,
    taxAmount: row.tax_amount,
    trip: row.trip as unknown as TripSnapshot,
    travellerNames: (row.travellers as unknown as StoredTraveller[]).map((t) => `${t.title} ${t.firstName} ${t.lastName}`),
    email: contact.email,
    phone: contact.phone,
    supplierPnr: row.booking_status === "confirmed" ? row.supplier_pnr : null,
    ticketNumbers: row.booking_status === "confirmed" ? row.ticket_numbers : [],
    paymentRef: row.booking_status === "confirmed" ? row.stripe_payment_intent_id : null,
    message: customerMessage(row, intent),
    clientSecret: open ? (intent?.client_secret ?? null) : null,
    publishableKey: open ? (keys?.publishable ?? null) : null,
    paymentAuthorised: open && intent?.status === "requires_capture",
  };
}

/* ------------------------------ admin summary ----------------------------- */

export type BookingPaymentSummary = {
  reference: string;
  amount: string;
  currency: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  cardholder_name: string | null;
  holdExpiresAt: string | null;
  /** What VootFly has on record. */
  recordedStatus: string;
  /** What Stripe says right now. Null when Stripe could not be asked. */
  gatewayStatus: string | null;
  receiptUrl: string | null;
  gatewayUrl: string | null;
};

const GATEWAY_LABEL: Record<string, string> = {
  requires_payment_method: "Waiting for a card",
  requires_confirmation: "Waiting for the customer",
  requires_action: "Waiting for bank verification",
  processing: "Processing",
  requires_capture: "Card on hold, not charged",
  succeeded: "Charged",
  canceled: "Cancelled, not charged",
};

/** The online payment behind a booking, or null for a booking request with no card payment. */
export async function bookingPaymentSummary(bookingId: string): Promise<BookingPaymentSummary | null> {
  const { data: row, error } = await (await db()).from("checkouts").select("*").eq("booking_id", bookingId).maybeSingle();
  // The checkouts table is only created when card payment is set up.
  if (error?.code === "PGRST205" || error?.code === "42P01") return null;
  if (error) {
    console.error("[checkout] payment summary read failed", bookingId, error);
    throw new Error("CHECKOUT_READ_FAILED");
  }
  if (!row) return null;

  const intentId = row.stripe_payment_intent_id;
  let gatewayStatus: string | null = null;
  let receiptUrl: string | null = null;
  if (intentId && stripeKeys()) {
    try {
      const intent = await retrievePaymentIntent(intentId);
      const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
      gatewayStatus = charge?.refunded ? "Refunded" : (GATEWAY_LABEL[intent.status] ?? intent.status);
      receiptUrl = charge?.receipt_url ?? null;
    } catch (e) {
      console.error("[checkout] could not read the payment from Stripe", bookingId, e);
    }
  }
  return {
    reference: row.reference,
    amount: row.amount,
    currency: row.currency,
    card_brand: row.card_brand,
    card_last4: row.card_last4,
    card_exp_month: row.card_exp_month,
    card_exp_year: row.card_exp_year,
    cardholder_name: row.cardholder_name,
    holdExpiresAt: row.booking_status === "awaiting_ticket" ? row.hold_expires_at : null,
    recordedStatus: row.payment_status,
    gatewayStatus,
    receiptUrl,
    gatewayUrl: intentId ? `https://dashboard.stripe.com/${row.test_mode ? "test/" : ""}payments/${intentId}` : null,
  };
}

/* --------------------------------- webhook -------------------------------- */

/** Handles a Stripe event whose signature has already been verified. Throwing makes Stripe retry. */
export async function handleStripeEvent(event: {
  type?: string;
  data?: { object?: { id?: string; payment_intent?: string | null; metadata?: Record<string, string>; last_payment_error?: { code?: string; decline_code?: string; message?: string } | null } };
}): Promise<void> {
  const object = event.data?.object;
  const checkoutId = object?.metadata?.["checkout_id"];

  switch (event.type) {
    case "payment_intent.amount_capturable_updated":
      if (checkoutId) await finalizeCheckout(checkoutId);
      return;
    case "payment_intent.payment_failed":
      // Recorded for staff. The checkout stays open because the customer can try another card.
      if (checkoutId) {
        await claim(checkoutId, "awaiting_payment", {
          payment_status: "failed",
          failure_code: object?.last_payment_error?.decline_code ?? object?.last_payment_error?.code ?? "payment_failed",
          failure_detail: object?.last_payment_error?.message ?? null,
        });
      }
      return;
    case "payment_intent.canceled": {
      if (!checkoutId) return;
      const opened = await claim(checkoutId, "awaiting_payment", { booking_status: "cancelled", payment_status: "cancelled" });
      if (opened) return;
      // A hold nobody charged in time: Stripe cancels it, and the sales team's queue must say so.
      const row = await loadCheckout(checkoutId);
      if (row?.booking_status === "awaiting_ticket") await closeHold(row, "hold_expired", "The hold ended in Stripe before the card was charged.");
      return;
    }
    case "charge.refunded":
      if (object?.payment_intent) await markRefunded(object.payment_intent);
      return;
    default:
      return;
  }
}
