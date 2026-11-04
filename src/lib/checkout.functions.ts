import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { bornOnFrom, contactSchema, passengerSchema } from "@/lib/checkout-validation";
import type { CheckoutView, QuoteResult, StartCheckoutResult } from "@/lib/checkout-shared";

const offerId = z.string().regex(/^off_[A-Za-z0-9_-]{6,80}$/);
const checkoutInput = z.object({ checkoutId: z.string().uuid() });

const fareRef = z.object({
  offerId: offerId.optional(),
  supplier: z.enum(["duffel", "mcontent", "pkfare"]).optional(),
  origin: z.string().min(3).max(4),
  destination: z.string().min(3).max(4),
  departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cabin: z.string().max(40),
  flightNo: z.string().min(1).max(60),
  passengers: z.number().int().min(1).max(9),
  price: z.string().max(20),
  currency: z.string().min(3).max(6),
});

/** The fare as the supplier states it right now, for the review page. */
export const getFareQuote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => fareRef.parse(data))
  .handler(async ({ data }): Promise<QuoteResult> => {
    const { quoteFare } = await import("@/lib/checkout.server");
    return quoteFare(data);
  });

const startInput = z.object({
  fare: fareRef,
  expectedTotal: z.string().max(20),
  acceptedTerms: z.literal(true),
  travellers: z.array(passengerSchema).min(1).max(9),
  contact: contactSchema,
  utmSource: z.string().max(80),
  clickId: z.string().max(160),
});

/** "Proceed to Payment": re-checks the fare, saves the checkout and opens a payment with Stripe. */
export const beginCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => startInput.parse(data))
  .handler(async ({ data }): Promise<StartCheckoutResult> => {
    const phone = `+${data.contact.phone.replace(/\D/g, "")}`;
    if (!data.contact.phone.trim().startsWith("+")) {
      return { status: "invalid", message: "Please add your country code to the phone number, such as +1." };
    }
    const travellers = [];
    for (const t of data.travellers) {
      const bornOn = bornOnFrom(t);
      if (!bornOn) return { status: "invalid", message: `Please check the date of birth for ${t.firstName} ${t.lastName}.` };
      travellers.push({
        title: t.title,
        gender: t.gender,
        firstName: t.firstName.trim(),
        lastName: t.lastName.trim(),
        bornOn,
        passportNo: t.passportNo.trim(),
        passportExpiry: t.passportExpiry,
        nationality: t.nationality,
      });
    }

    // Owner is derived from the bearer token only — never from client input.
    let userId: string | null = null;
    const token = getRequestHeader("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      userId = userData.user?.id ?? null;
    }

    const { startCheckout } = await import("@/lib/checkout.server");
    return startCheckout({
      fare: data.fare,
      expectedTotal: data.expectedTotal,
      travellers,
      contact: { ...data.contact, phone, email: data.contact.email.trim() },
      utmSource: data.utmSource,
      clickId: data.clickId,
      userId,
    });
  });

export const getCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutInput.parse(data))
  .handler(async ({ data }): Promise<CheckoutView | null> => {
    const { checkoutView } = await import("@/lib/checkout.server");
    return checkoutView(data.checkoutId);
  });

/**
 * Called after the card form reports success. That report is not trusted: this asks Stripe
 * itself, and only a real hold reaches the sales team.
 */
export const confirmCheckoutPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutInput.parse(data))
  .handler(async ({ data }): Promise<CheckoutView | null> => {
    const { checkoutView, finalizeCheckout } = await import("@/lib/checkout.server");
    await finalizeCheckout(data.checkoutId);
    return checkoutView(data.checkoutId);
  });

export const cancelCheckoutPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutInput.parse(data))
  .handler(async ({ data }): Promise<CheckoutView | null> => {
    const { cancelCheckout, checkoutView } = await import("@/lib/checkout.server");
    await cancelCheckout(data.checkoutId);
    return checkoutView(data.checkoutId);
  });
