import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { revalidateFare } from "@/lib/fare-revalidation.server";

const bookingInput = z.object({
  pnr: z.string().min(3).max(32),
  origin: z.string().min(3).max(4),
  destination: z.string().min(3).max(4),
  airline: z.string().max(120).optional(),
  cabinClass: z.string().max(40).optional(),
  departDate: z.string().max(20).optional(),
  returnDate: z.string().max(20).optional(),
  /** Supplier that quoted the fare (1 Nov 2026); the re-check asks the same one. */
  supplier: z.enum(["duffel", "mcontent", "pkfare"]).optional(),
  totalPrice: z.number().nonnegative(),
  currency: z.string().min(3).max(6),
  utmSource: z.string().max(80).optional(),
  clickId: z.string().max(160).optional(),
  promoCode: z.string().max(60).optional(),
  promoDiscount: z.number().nonnegative().optional(),
  guestEmail: z.string().max(160).optional(),
  guestPhone: z.string().max(60).optional(),
  billingAddress: z.string().max(240).optional(),
  billingCity: z.string().max(120).optional(),
  billingCountry: z.string().max(120).optional(),
  billingPostalCode: z.string().max(40).optional(),

  passenger: z.object({
    title: z.string().max(20).optional(),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    gender: z.string().max(20).optional(),
    passportNo: z.string().max(40).optional(),
    dob: z.string().max(20).nullable().optional(),
  }),
  payment: z.object({
    method: z.string().max(40).optional(),
    amount: z.number().nonnegative(),
  }),
});

export type CreateBookingInput = z.infer<typeof bookingInput>;

/**
 * VootFly does not collect or store card details anywhere in this flow --
 * removed 2026-09-05 (previously encrypted and stored the full card number
 * via a custom encryptPan() helper instead of a real, PCI-compliant payment
 * processor, and the "payment capture" admin action never actually called
 * any payment API -- see admin.functions.ts). This creates a booking
 * REQUEST only: passenger + contact details, no payment. Real payment
 * collection needs a proper integration (e.g. Stripe Elements/PaymentIntents,
 * where VootFly never receives the raw card number) before any card data
 * should be collected again.
 */
export type CreateBookingResult =
  | { ok: true; id: string }
  | { ok: false; reason: "price_changed"; originalPrice: number; newPrice: number; currency: string }
  | { ok: false; reason: "unavailable" }
  | { ok: false; reason: "check_failed" };

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingInput.parse(data))
  .handler(async ({ data }): Promise<CreateBookingResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fare/Offer Revalidation (blocking, per explicit instruction): a real,
    // fresh PKFARE check runs BEFORE a booking is created, every single
    // submission attempt -- including a resubmission after the customer
    // accepts a changed price, since that resubmission arrives as an
    // ordinary call to this same function with the new totalPrice. There
    // is no separate "skip the check this time" path: every attempt is
    // freshly verified, so a booking is never created against a stale or
    // unverified fare, matching "never submit an outdated or unverified
    // fare" literally, not just for the first attempt.
    //
    // A missing departDate is treated the same as check_failed (cannot be
    // verified) rather than silently skipped, for the same reason.
    const ALLOWED_CABINS = ["Economy", "PremiumEconomy", "Business", "First"] as const;
    const cabinForCheck = ALLOWED_CABINS.find((c) => c === data.cabinClass);
    const revalidation = data.departDate
      ? await revalidateFare({
          origin: data.origin,
          destination: data.destination,
          departDate: data.departDate,
          ...(data.returnDate ? { returnDate: data.returnDate } : {}),
          ...(data.supplier ? { supplier: data.supplier } : {}),
          cabinClass: cabinForCheck,
          originalPrice: data.totalPrice,
          currency: data.currency,
        })
      : null;

    if (!revalidation || revalidation.status === "check_failed") {
      return { ok: false, reason: "check_failed" };
    }
    if (revalidation.status === "unavailable") {
      return { ok: false, reason: "unavailable" };
    }
    if (revalidation.status === "price_changed") {
      return {
        ok: false,
        reason: "price_changed",
        originalPrice: data.totalPrice,
        // currentPrice is guaranteed non-null when status is price_changed
        // (see revalidateFare) -- real, never a fabricated fallback.
        newPrice: revalidation.currentPrice as number,
        currency: data.currency.toUpperCase(),
      };
    }
    // status === "confirmed" -- real, verified, proceed.

    // Owner is derived from the bearer token only — never from client input.
    let userId: string | null = null;
    const auth = getRequestHeader("authorization");
    const token = auth?.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      userId = userData.user?.id ?? null;
    }

    // Source is derived server-side: affiliate when a partner sent us the click,
    // otherwise this is an organic/direct site booking.
    const source = (data.utmSource || "").trim() ? (data.utmSource as string).trim().toLowerCase() : "direct";

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        pnr: data.pnr,
        user_id: userId,
        source,
        lead_name: `${data.passenger.firstName} ${data.passenger.lastName}`.trim(),
        guest_email: data.guestEmail ?? null,
        guest_phone: data.guestPhone ?? null,
        billing_address: data.billingAddress ?? null,
        billing_city: data.billingCity ?? null,
        billing_country: data.billingCountry ?? null,
        billing_postal_code: data.billingPostalCode ?? null,
        origin: data.origin,
        destination: data.destination,
        airline: data.airline ?? null,
        cabin_class: data.cabinClass ?? null,
        depart_date: data.departDate || null,
        total_price: data.totalPrice,
        currency: data.currency.toUpperCase(),
        utm_source: data.utmSource || null,
        click_id: data.clickId || null,
        promo_code: data.promoCode || null,
        promo_discount: data.promoDiscount ?? 0,
        verification_status: "pending_verification",
        capture_status: "not_applicable",
        // Revenue/Commission Data Foundation (Phase 2): gross_fare is the
        // real price PKFARE quoted (currently always equal to total_price,
        // since no markup logic exists yet -- not a separate invented
        // number). markup_amount/commission_amount stay null: there is no
        // real markup/commission business rule to populate them with, and
        // this does not fabricate one.
        gross_fare: data.totalPrice,
        // The supplier that actually quoted this fare (carried from the search result).
        supplier_code: data.supplier ?? (await import("@/lib/fare-provider.server")).activeFareProvider(),
        revalidation_status: revalidation.status,
        revalidated_price: revalidation.currentPrice,
        revalidated_at: revalidation.checkedAt,
      })
      .select("id")
      .single();

    if (error || !booking) {
      console.error("[createBooking] insert failed", error);
      throw new Error("BOOKING_SAVE_FAILED");
    }

    const { error: paxError } = await supabaseAdmin.from("passengers").insert({
      booking_id: booking.id,
      title: data.passenger.title ?? null,
      first_name: data.passenger.firstName,
      last_name: data.passenger.lastName,
      gender: data.passenger.gender ?? null,
      passport_no: data.passenger.passportNo ?? null,
      dob: data.passenger.dob || null,
    });
    if (paxError) console.error("[createBooking] passenger insert failed", paxError);

    const { error: payError } = await supabaseAdmin.from("payments").insert({
      booking_id: booking.id,
      amount: data.payment.amount,
      currency: data.currency.toUpperCase(),
      method: data.payment.method ?? null,
      transaction_ref: data.pnr,
      status: "pending_auth",
    });
    if (payError) console.error("[createBooking] payment insert failed", payError);

    // Tell n8n immediately that a booking request exists, so the advisor alert
    // and traveller confirmation run once per real booking. Added 29 Sep 2026
    // after polling every 5 minutes (576 runs a day with zero bookings) used up
    // the shared n8n plan's monthly allowance. Never fails the booking: the
    // calls are capped at 3 seconds and errors are swallowed; a missed signal
    // is caught by n8n's scheduled safety-net run.
    await notifyBookingCreated();
    return { ok: true, id: booking.id };
  });


/** Ping the n8n booking workflows (advisor alert, traveller confirmation). */
async function notifyBookingCreated(): Promise<void> {
  const secret = process.env["N8N_WEBHOOK_SECRET"];
  if (!secret) return;
  const hooks = [
    "https://faresmatch.app.n8n.cloud/webhook/vootfly-booking-alert",
    "https://faresmatch.app.n8n.cloud/webhook/vootfly-traveller-confirmation",
  ];
  await Promise.allSettled(
    hooks.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-webhook-secret": secret },
        body: "{}",
        signal: AbortSignal.timeout(3000),
      }),
    ),
  );
}
