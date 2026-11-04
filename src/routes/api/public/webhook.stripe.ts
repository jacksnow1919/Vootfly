import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/webhook/stripe
 *
 * Stripe's own report of payment events, so a booking still completes if the customer
 * closes the tab straight after paying. Only requests signed with STRIPE_WEBHOOK_SECRET
 * are accepted. Repeat deliveries are harmless: finalizeCheckout only acts once.
 * Events to subscribe to: payment_intent.amount_capturable_updated,
 * payment_intent.payment_failed, payment_intent.canceled, charge.refunded.
 */
export const Route = createFileRoute("/api/public/webhook/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"]?.trim();
        if (!secret) return new Response("Not configured", { status: 503 });

        const payload = await request.text();
        const { verifyWebhookSignature } = await import("@/lib/stripe.server");
        const valid = await verifyWebhookSignature(payload, request.headers.get("stripe-signature"), secret);
        if (!valid) return new Response("Invalid signature", { status: 400 });

        const { handleStripeEvent } = await import("@/lib/checkout.server");
        try {
          await handleStripeEvent(JSON.parse(payload));
        } catch (e) {
          // A non-2xx answer makes Stripe deliver the event again later.
          console.error("[webhook.stripe] handling failed", e);
          return new Response("Could not process event", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
