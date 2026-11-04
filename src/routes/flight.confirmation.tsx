import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, TestTube2 } from "lucide-react";
import { z } from "zod";
import { TripDetails } from "@/components/checkout/TripDetails";
import { Steps } from "@/components/site/ui";
import { getCheckout } from "@/lib/checkout.functions";
import { formatAmount, type CheckoutView } from "@/lib/checkout-shared";

const SUPPORT_PHONE = "+1-800-773-6613";

const searchSchema = z.object({ checkout: z.string().uuid().catch("") });

export const Route = createFileRoute("/flight/confirmation")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Booking Confirmed | VootFly" },
      { name: "description", content: "Your VootFly flight booking confirmation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmationPage,
});

/**
 * Everything here comes from the server's record of a checkout whose ticket the team issued
 * and Stripe charged. Without that record the page shows no confirmation at all.
 */
function ConfirmationPage() {
  const { checkout: checkoutId } = Route.useSearch();
  const navigate = useNavigate();
  const [view, setView] = useState<CheckoutView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!checkoutId) {
      setState("missing");
      return;
    }
    getCheckout({ data: { checkoutId } })
      .then((next) => {
        if (next?.bookingStatus === "confirmed") {
          setView(next);
          setState("ready");
        } else if (next) {
          void navigate({ to: "/flight/payment", search: { checkout: checkoutId }, replace: true });
        } else {
          setState("missing");
        }
      })
      .catch((e) => {
        console.error("[confirmation] loading failed", e);
        setState("missing");
      });
  }, [checkoutId, navigate]);

  if (state !== "ready" || !view) {
    return (
      <div className="grid min-h-[70dvh] place-items-center bg-secondary/50 px-4 text-center">
        {state === "loading" ? (
          <Loader2 className="size-8 animate-spin text-gold" aria-label="Loading your booking" />
        ) : (
          <div>
            <h1 className="font-display text-2xl font-semibold text-navy">We couldn't find this booking</h1>
            <p className="mt-2 text-sm text-muted-foreground">If you've paid and need help, please call {SUPPORT_PHONE}.</p>
            <Link to="/" className="mt-4 inline-block rounded-xl bg-gold px-5 py-3 text-sm font-bold text-gold-foreground">Search flights</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-secondary/50 px-4 py-6 pb-24">
      <div className="mx-auto max-w-4xl space-y-4">
        <Steps current={6} />
        {view.testMode ? (
          <p className="flex items-start gap-2 rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <TestTube2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            TEST BOOKING: made in test mode. No real money moved and this is not a real ticket.
          </p>
        ) : null}

        <section className="rounded-2xl bg-[#2E7D32] p-6 text-center text-white sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#43A047] ring-4 ring-white/30">
            <Check className="size-8" strokeWidth={3} aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold">Booking confirmed</h1>
          <p className="mt-2 text-sm text-white/90">Your ticket has been issued and your payment is complete.</p>
          <p className="mt-4 text-xs uppercase tracking-widest text-white/80">Airline booking reference (PNR)</p>
          <p className="font-display text-4xl font-semibold tracking-widest">{view.supplierPnr}</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Booking details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Line label="VootFly reference" value={view.reference} />
            <Line label="Airline" value={view.trip.airline} />
            {view.ticketNumbers.length ? <Line label="E-ticket numbers" value={view.ticketNumbers.join(", ")} /> : null}
            <Line label="Amount paid" value={formatAmount(view.amount, view.currency)} />
            {view.paymentRef ? <Line label="Payment reference" value={view.paymentRef} /> : null}
            <Line label="Contact email" value={view.email} />
          </dl>
          <h3 className="mt-4 font-display text-sm font-semibold text-navy">Travellers</h3>
          <ul className="mt-1 space-y-1 text-sm font-semibold text-navy">
            {view.travellerNames.map((name) => <li key={name}>{name}</li>)}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Your flight</h2>
          <div className="mt-3"><TripDetails trip={view.trip} /></div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link to="/" className="inline-flex items-center justify-center rounded-xl bg-navy px-5 py-3 text-sm font-bold text-navy-foreground">Back to home</Link>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-3 text-sm font-bold text-navy">
            Print booking
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-navy">{value}</dd>
    </div>
  );
}
