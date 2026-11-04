/**
 * Online card checkout — SERVER ONLY (added 3 Nov 2026).
 *
 * The order of events is the whole point of this file:
 *   1. The amount comes from a fresh read of the airline's offer, never from the browser.
 *   2. The customer's card is HELD through Stripe (manual capture), not charged.
 *   3. finalizeCheckout asks Stripe directly whether the hold is real. The browser saying
 *      "paid" counts for nothing.
 *   4. Only then is the airline order created.
 *   5. Only after the airline confirms, with a real booking reference, is the card charged.
 *
 * If the airline refuses, the hold is released and the customer is not charged. If the
 * outcome is unclear (no answer from Duffel, or the charge fails after ticketing), nothing
 * is released or claimed: the checkout goes to manual_review for staff.
 *
 * Duplicates: the browser and the Stripe webhook can both call finalizeCheckout, any number
 * of times. Whichever claims the row first (a single conditional update) does the work; the
 * others just read the result. Stripe and Duffel calls also carry their own protection:
 * idempotency keys, and an offer that can only be booked once.
 */
import type { Database, Json } from "@/integrations/supabase/types";
import { countryCode } from "./countries";
import { duffelIsTestMode } from "./fare-provider.server";
import { createDuffelOrder, getDuffelOffer, type DuffelOrderPassenger, type DuffelQuote } from "./duffel.server";
import {
  cancelPaymentIntent,
  capturePaymentIntent,
  createPaymentIntent,
  maskedCard,
  refundPaymentIntent,
  retrievePaymentIntent,
  StripeError,
  stripeIsTestMode,
  stripeKeys,
  toMinorUnits,
  type StripePaymentIntent,
} from "./stripe.server";
import type { BookingStatus, CheckoutView, PaymentStatus, PublicQuote, QuoteResult, StartCheckoutResult, TripSnapshot } from "./checkout-shared";

type CheckoutRow = Database["public"]["Tables"]["checkouts"]["Row"];
type CheckoutUpdate = Database["public"]["Tables"]["checkouts"]["Update"];

export type StoredTraveller = {
  passengerId: string;
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
/** Longest a Duffel order call can take (see ORDER_TIMEOUT_MS), plus room to save the result. */
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

const publicQuote = (q: DuffelQuote): PublicQuote => ({ total: q.total, currency: q.currency, base: q.base, tax: q.tax, trip: q.trip });

/** Real card checkout is on only with Stripe keys present, and never takes real money for a test airline. */
const paymentsOn = () => Boolean(stripeKeys()) && (stripeIsTestMode() || !duffelIsTestMode());

export async function quoteOffer(offerId: string): Promise<QuoteResult> {
  if (!paymentsOn()) return { status: "payments_off" };
  const result = await getDuffelOffer(offerId);
  return result.ok ? { status: "ok", quote: publicQuote(result.quote) } : { status: result.reason };
}

function newReference(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `VF${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

export async function startCheckout(input: {
  offerId: string;
  /** The total the customer saw on the review page. Only used to spot a change, never charged. */
  expectedTotal: string;
  travellers: Omit<StoredTraveller, "passengerId">[];
  contact: StoredContact;
  utmSource: string;
  clickId: string;
  userId: string | null;
}): Promise<StartCheckoutResult> {
  if (!paymentsOn()) return { status: "payments_off" };

  const offer = await getDuffelOffer(input.offerId);
  if (!offer.ok) return { status: offer.reason };
  const quote = offer.quote;

  if (quote.total !== input.expectedTotal) return { status: "price_changed", quote: publicQuote(quote) };
  if (quote.passengerIds.length !== input.travellers.length) {
    return { status: "invalid", message: `This fare is for ${quote.passengerIds.length} traveller(s). Please search again if your party has changed.` };
  }
  if (quote.identityDocumentsRequired && input.travellers.some((t) => !countryCode(t.nationality ?? ""))) {
    return { status: "invalid", message: "Please choose each traveller's nationality from the list." };
  }

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
      supplier_offer_id: quote.offerId,
      currency: quote.currency,
      amount: quote.total,
      amount_minor: amountMinor,
      base_amount: quote.base,
      tax_amount: quote.tax,
      trip: quote.trip as unknown as Json,
      travellers: input.travellers.map((t, i) => ({ ...t, passengerId: quote.passengerIds[i]! })) as unknown as Json,
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

function orderPassengers(row: CheckoutRow, identityDocuments: boolean): DuffelOrderPassenger[] {
  const contact = row.contact as unknown as StoredContact;
  return (row.travellers as unknown as StoredTraveller[]).map((t) => ({
    id: t.passengerId,
    title: t.title.toLowerCase(),
    gender: t.gender === "Female" ? "f" : "m",
    given_name: t.firstName,
    family_name: t.lastName,
    born_on: t.bornOn ?? "",
    email: contact.email,
    phone_number: contact.phone,
    ...(identityDocuments
      ? {
          identity_documents: [
            {
              type: "passport" as const,
              unique_identifier: t.passportNo ?? "",
              issuing_country_code: countryCode(t.nationality ?? "") ?? "",
              expires_on: t.passportExpiry ?? "",
            },
          ],
        }
      : {}),
  }));
}

/** Passport and birth details stay only until the order is settled; `passengers` keeps what staff need. */
function withoutIdentity(row: CheckoutRow): Json {
  return (row.travellers as unknown as StoredTraveller[]).map(({ passengerId, title, gender, firstName, lastName }) => ({
    passengerId,
    title,
    gender,
    firstName,
    lastName,
  })) as unknown as Json;
}

/** A row stuck mid-booking means the request died (e.g. the Worker's CPU limit). Hand it to staff. */
async function reviewIfStuck(row: CheckoutRow): Promise<CheckoutRow> {
  if (row.booking_status !== "payment_confirmed" && row.booking_status !== "booking_in_progress") return row;
  const claimedAt = row.claimed_at ? Date.parse(row.claimed_at) : 0;
  if (Date.now() - claimedAt < STUCK_AFTER_MS) return row;
  return (
    (await claim(row.id, row.booking_status as BookingStatus, {
      booking_status: "manual_review",
      failure_code: "processing_interrupted",
      failure_detail: "Processing stopped before a result was saved. Check Duffel for an order with this checkout id in its metadata before retrying or releasing the hold.",
    })) ?? row
  );
}

/**
 * Safe to call any number of times, from the browser or the webhook. Verifies the payment
 * with Stripe, then books, then charges. Returns the row as it now stands.
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

  const claimed = await claim(row.id, "awaiting_payment", {
    booking_status: "payment_confirmed",
    payment_status: "processing",
    claimed_at: new Date().toISOString(),
    failure_code: null,
    failure_detail: null,
    ...maskedCard(intent),
  });
  if (!claimed) return loadCheckout(id);

  // A test payment must never buy a real ticket from the prefunded Duffel Balance.
  if (claimed.test_mode && !duffelIsTestMode()) {
    return releaseHold(claimed, "test_payment_live_fares", "Stripe test key with a live Duffel token: no order was attempted.");
  }

  const inProgress = await patch(claimed.id, { booking_status: "booking_in_progress" });
  const offer = await getDuffelOffer(inProgress.supplier_offer_id);
  if (!offer.ok && offer.reason === "unavailable") {
    return releaseHold(inProgress, "offer_no_longer_available", "The offer could no longer be booked when payment finished.");
  }
  const identityDocuments = offer.ok ? offer.quote.identityDocumentsRequired : true;

  const order = await createDuffelOrder({
    offerId: inProgress.supplier_offer_id,
    amount: inProgress.amount,
    currency: inProgress.currency,
    passengers: orderPassengers(inProgress, identityDocuments),
    checkoutId: inProgress.id,
  });

  if (!order.ok) {
    if (order.outcome === "refused") return releaseHold(inProgress, order.code, order.message);
    return patch(inProgress.id, { booking_status: "manual_review", failure_code: order.code, failure_detail: order.message });
  }

  // Save the airline's answer before anything else can go wrong.
  const booked = await patch(inProgress.id, {
    supplier_order_id: order.orderId,
    supplier_pnr: order.bookingReference,
    ticket_numbers: order.ticketNumbers,
  });

  try {
    await capturePaymentIntent(inProgress.stripe_payment_intent_id!);
  } catch (e) {
    console.error("[checkout] capture failed after the airline confirmed", booked.id, e);
    return patch(booked.id, {
      booking_status: "manual_review",
      failure_code: "capture_failed",
      failure_detail: `Airline order ${order.orderId} (${order.bookingReference}) exists but the card charge failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  const confirmed = await patch(booked.id, {
    booking_status: "confirmed",
    payment_status: "paid",
    paid_at: new Date().toISOString(),
  });
  return recordConfirmedBooking(confirmed);
}

async function releaseHold(row: CheckoutRow, code: string, detail: string): Promise<CheckoutRow> {
  try {
    await cancelPaymentIntent(row.stripe_payment_intent_id!);
  } catch (e) {
    console.error("[checkout] could not release the hold", row.id, e);
    return patch(row.id, {
      booking_status: "manual_review",
      failure_code: "release_failed",
      failure_detail: `${code}: ${detail}. The card hold could not be released: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
  return patch(row.id, {
    booking_status: "failed",
    payment_status: "cancelled",
    failure_code: code,
    failure_detail: detail,
    travellers: withoutIdentity(row),
  });
}

/**
 * Copies a confirmed, paid checkout into the tables the admin and alerts already use. Test
 * checkouts stay out, so test bookings never reach the real list, advisors or partners. A
 * failure here cannot undo a real booking, so it is logged and the checkout stays confirmed;
 * the admin Online payments tab shows when no booking row was created.
 */
async function recordConfirmedBooking(row: CheckoutRow): Promise<CheckoutRow> {
  if (row.test_mode) return patch(row.id, { travellers: withoutIdentity(row) });

  const supabase = await db();
  const trip = row.trip as unknown as TripSnapshot;
  const travellers = row.travellers as unknown as StoredTraveller[];
  const contact = row.contact as unknown as StoredContact;
  const lead = travellers[0]!;
  const outbound = trip.slices[0];
  const inbound = trip.slices[1];
  const now = new Date().toISOString();
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
      status: row.ticket_numbers.length ? "issued" : "confirmed",
      verification_status: "verified",
      verified_by_name: "Online payment",
      verified_at: now,
      capture_status: "captured",
      captured_at: row.paid_at ?? now,
      gross_fare: amount,
      supplier_code: row.supplier,
      revalidation_status: "confirmed",
      revalidated_price: amount,
      revalidated_at: now,
      // That n8n email says "we received your request and will call you", which is wrong for a paid booking.
      traveller_notified_at: now,
    })
    .select("id")
    .single();
  if (error || !booking) {
    console.error("[checkout] confirmed booking could not be copied to bookings", row.id, error);
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
      status: "captured",
    }),
    supabase.from("tickets").insert(
      (row.ticket_numbers.length ? row.ticket_numbers : [null]).map((ticket_number) => ({
        booking_id: booking.id,
        ticket_number,
        supplier: row.supplier,
        pnr_code: row.supplier_pnr,
      })),
    ),
  ]);
  for (const r of results) if (r.error) console.error("[checkout] booking detail insert failed", row.id, r.error);

  const { notifyBookingCreated } = await import("./bookings.functions");
  await notifyBookingCreated().catch(() => undefined);
  if (row.click_id) {
    const { notifyEazairWebhook } = await import("./eazair.functions");
    await notifyEazairWebhook({
      data: {
        clickId: row.click_id,
        pnr: row.reference,
        amount,
        currency: row.currency,
        route: `${outbound?.origin ?? ""}-${outbound?.destination ?? ""}`,
      },
    }).catch(() => undefined);
  }

  return patch(row.id, { booking_id: booking.id, travellers: withoutIdentity(row) });
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

/** A declined card leaves the checkout open: the customer can try again on the same page. */
function attemptMessage(intent: StripePaymentIntent | null): string | null {
  return intent?.last_payment_error?.message ?? null;
}

function customerMessage(row: CheckoutRow, intent: StripePaymentIntent | null): string | null {
  switch (row.booking_status) {
    case "awaiting_payment":
      return attemptMessage(intent);
    case "failed":
      if (row.failure_code === "test_payment_live_fares") {
        return "The test card worked, but no ticket was booked because this computer is using live fares. Add a Duffel test token to try a full test booking. The test hold has been released.";
      }
      if (row.failure_code === "payment_setup_failed") return "We couldn't start this payment. You have not been charged. Please try again.";
      return "The airline couldn't confirm this booking, so nothing was booked. You have not been charged, and the hold on your card has been released. Your bank may take a few days to remove it.";
    case "manual_review":
      return `This booking isn't confirmed yet because it needs a check by our team. Please don't try to pay again. We'll contact you, or you can call ${SUPPORT_PHONE} and quote ${row.reference}.`;
    case "cancelled":
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
    noTicketInThisMode: row.test_mode && !duffelIsTestMode(),
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

async function markRefunded(intentId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase
    .from("checkouts")
    .update({ payment_status: "refunded", updated_at: new Date().toISOString() })
    .eq("stripe_payment_intent_id", intentId);
  if (error) throw error;
  await supabase.from("payments").update({ status: "refunded" }).eq("transaction_ref", intentId);
}

export type RefundResult =
  | { ok: true; reference: string; amount: string; currency: string; bookingId: string | null }
  | { ok: false; message: string };

/** Staff refund of a charged card. Moves money only, so the airline ticket must be cancelled separately. */
export async function refundCheckout(id: string): Promise<RefundResult> {
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
  return { ok: true, reference: row.reference, amount: row.amount, currency: row.currency, bookingId: row.booking_id };
}

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
    case "payment_intent.canceled":
      if (checkoutId) await claim(checkoutId, "awaiting_payment", { booking_status: "cancelled", payment_status: "cancelled" });
      return;
    case "charge.refunded": {
      const intentId = object?.payment_intent;
      if (intentId) await markRefunded(intentId);
      return;
    }
    default:
      return;
  }
}
