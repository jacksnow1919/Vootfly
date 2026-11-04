import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { AlertTriangle, Loader2, Lock, ShieldCheck, TestTube2, XCircle } from "lucide-react";
import { z } from "zod";
import { FareSummary, ServiceFeeNote, TripDetails } from "@/components/checkout/TripDetails";
import { Steps } from "@/components/site/ui";
import { track } from "@/lib/analytics";
import { cancelCheckoutPayment, confirmCheckoutPayment, getCheckout } from "@/lib/checkout.functions";
import { CHECKOUT_DRAFT_KEY, CHECKOUT_RETURN_KEY, formatAmount, type CheckoutView } from "@/lib/checkout-shared";

const SUPPORT_PHONE = "+1-800-773-6613";

const searchSchema = z.object({ checkout: z.string().uuid().catch("") });

export const Route = createFileRoute("/flight/payment")({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Secure Payment | VootFly" },
      { name: "description", content: "Pay securely by card for your VootFly flight booking." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentPage,
});

const APPEARANCE: Appearance = {
  theme: "night",
  variables: { colorPrimary: "#FF6B0A", colorBackground: "#102F63", colorText: "#FFFFFF", borderRadius: "12px", fontSizeBase: "15px" },
};

function PaymentPage() {
  const { checkout: checkoutId } = Route.useSearch();
  const navigate = useNavigate();
  const [view, setView] = useState<CheckoutView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  /** The server is verifying the payment and booking with the airline. */
  const [settling, setSettling] = useState(false);

  const settle = useCallback(async () => {
    setSettling(true);
    try {
      const next = await confirmCheckoutPayment({ data: { checkoutId } });
      if (next) setView(next);
    } catch (e) {
      // The outcome is unknown, so the page keeps checking rather than claiming either result.
      console.error("[payment] confirming failed", e);
      setLoadFailed(true);
    } finally {
      setSettling(false);
    }
  }, [checkoutId]);

  useEffect(() => {
    if (!checkoutId) {
      setLoading(false);
      return;
    }
    let live = true;
    getCheckout({ data: { checkoutId } })
      .then((next) => {
        if (!live) return;
        setView(next);
        // Back from a bank's 3D Secure page, or the page was reloaded after paying.
        if (next?.paymentAuthorised) void settle();
      })
      .catch((e) => {
        console.error("[payment] loading failed", e);
        if (live) setLoadFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [checkoutId, settle]);

  const busyOnServer = view?.bookingStatus === "payment_confirmed" || view?.bookingStatus === "booking_in_progress";

  // Another request (or Stripe's webhook) is finishing this booking: keep checking until it settles.
  useEffect(() => {
    if (!busyOnServer && !loadFailed) return;
    if (settling) return;
    const timer = setInterval(() => {
      getCheckout({ data: { checkoutId } })
        .then((next) => {
          if (!next) return;
          setLoadFailed(false);
          setView(next);
          if (next.paymentAuthorised) void settle();
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, [busyOnServer, loadFailed, settling, checkoutId, settle]);

  useEffect(() => {
    if (view?.bookingStatus !== "confirmed") return;
    if (!view.testMode) track("Booking Confirmed", { pnr: view.reference, gross_amount: Number(view.amount) });
    try {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
      sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
    } catch {
      /* storage unavailable */
    }
    void navigate({ to: "/flight/confirmation", search: { checkout: view.id }, replace: true });
  }, [view, navigate]);

  const cancel = async () => {
    try {
      const next = await cancelCheckoutPayment({ data: { checkoutId } });
      if (next) setView(next);
    } catch (e) {
      console.error("[payment] cancelling failed", e);
    }
  };

  if (loading) return <Notice icon={<Loader2 className="size-8 animate-spin text-gold" />} title="Loading your payment…" />;
  if (!view) {
    return (
      <Notice
        icon={<AlertTriangle className="size-8 text-gold" />}
        title={loadFailed ? "We couldn't load this payment" : "We couldn't find this payment"}
        body={`You have not been charged by this page. Please search again, or call ${SUPPORT_PHONE} if you need help.`}
      >
        <Link to="/" className="rounded-xl bg-gold px-5 py-3 text-sm font-bold text-gold-foreground">Search flights</Link>
      </Notice>
    );
  }

  if (settling || busyOnServer || view.bookingStatus === "confirmed" || (loadFailed && view.bookingStatus === "awaiting_payment" && view.paymentAuthorised)) {
    return (
      <Notice
        icon={<Loader2 className="size-8 animate-spin text-gold" />}
        title="Confirming your booking with the airline…"
        body="Your card is on hold and is only charged once the airline confirms. Please keep this page open. This can take up to a minute."
      />
    );
  }

  if (view.bookingStatus === "failed") {
    return (
      <Notice icon={<XCircle className="size-8 text-destructive" />} title="Your booking was not completed" body={view.message ?? undefined}>
        <ReturnLink label="Back to checkout" />
      </Notice>
    );
  }
  if (view.bookingStatus === "cancelled") {
    return (
      <Notice icon={<XCircle className="size-8 text-muted-foreground" />} title="Payment cancelled" body={view.message ?? undefined}>
        <ReturnLink label="Back to checkout" />
      </Notice>
    );
  }
  if (view.bookingStatus === "manual_review") {
    return (
      <Notice icon={<AlertTriangle className="size-8 text-gold" />} title="Your booking needs a check by our team" body={view.message ?? undefined}>
        <a href={`tel:${SUPPORT_PHONE}`} className="rounded-xl bg-gold px-5 py-3 text-sm font-bold text-gold-foreground">Call {SUPPORT_PHONE}</a>
      </Notice>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-secondary/50 px-4 py-6 pb-24">
      <div className="mx-auto max-w-7xl space-y-4">
        <Steps current={5} />
        {view.testMode ? <TestBanner noTicket={view.noTicketInThisMode} /> : null}
      </div>
      <div className="mx-auto mt-4 grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-navy">
              <Lock className="size-5 text-gold" aria-hidden="true" /> Secure Payment
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              VootFly booking {view.reference}. Card details go directly to Stripe, our payment processor. VootFly never
              sees or stores your full card number.
            </p>
            <div className="mt-4">
              {view.clientSecret && view.publishableKey ? (
                <CardPayment view={view} onAuthorised={settle} />
              ) : (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">
                  We couldn't open the card form. You have not been charged. Please reload this page, or call {SUPPORT_PHONE}.
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-gold" aria-hidden="true" />
                Your card is held now and only charged after the airline confirms your booking.
              </p>
              <button type="button" onClick={cancel} className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-navy">
                Cancel payment
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
            <h2 className="font-display text-lg font-semibold text-navy">Your flight with {view.trip.airline}</h2>
            <div className="mt-3"><TripDetails trip={view.trip} /></div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
            <h2 className="font-display text-lg font-semibold text-navy">Travellers</h2>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-navy">
              {view.travellerNames.map((name) => <li key={name}>{name}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Booking details go to {view.email}.</p>
            <p className="mt-3 text-xs text-muted-foreground">
              By paying you accept our <a href="/terms" className="font-semibold text-navy underline">Terms &amp; Conditions</a> and{" "}
              <a href="/refund-policy" className="font-semibold text-navy underline">Refund &amp; Cancellation Policy</a>.
            </p>
          </section>
        </div>
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <FareSummary
            title="Price Summary"
            base={view.baseAmount}
            tax={view.taxAmount}
            total={view.amount}
            currency={view.currency}
            travellers={view.travellerNames.length}
            footer={<ServiceFeeNote />}
          />
        </aside>
      </div>
    </div>
  );
}

function CardPayment({ view, onAuthorised }: { view: CheckoutView; onAuthorised: () => Promise<void> }) {
  const stripePromise = useMemo(() => loadStripe(view.publishableKey!), [view.publishableKey]);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: view.clientSecret!, appearance: APPEARANCE }}>
      <CardForm view={view} onAuthorised={onAuthorised} />
    </Elements>
  );
}

function CardForm({ view, onAuthorised }: { view: CheckoutView; onAuthorised: () => Promise<void> }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState(view.message ?? "");
  const [cardName, setCardName] = useState("");

  const pay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    setMessage("");
    track("Payment Submitted", { amount: Number(view.amount), currency: view.currency });
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: { billing_details: { name: cardName.trim() } },
      },
    });
    if (error) {
      setMessage(error.message ?? "Your card could not be processed. You have not been charged. Please try again.");
      setPaying(false);
      return;
    }
    // Not trusted as proof of payment: the server now asks Stripe directly before booking anything.
    await onAuthorised();
  };

  return (
    <div className="rounded-2xl bg-navy p-4 sm:p-5">
      <label htmlFor="card-name" className="text-sm text-navy-foreground">
        Name on card
      </label>
      <input
        id="card-name"
        value={cardName}
        onChange={(e) => setCardName(e.target.value)}
        autoComplete="cc-name"
        placeholder="As printed on the card"
        className="mb-3 mt-1 w-full rounded-xl border border-gold/30 bg-white/5 px-3 py-2.5 text-sm text-navy-foreground outline-none placeholder:text-navy-foreground/50 focus:border-gold"
      />
      <PaymentElement
        onReady={() => setReady(true)}
        options={{ layout: "tabs", defaultValues: { billingDetails: { email: view.email, phone: view.phone } } }}
      />
      {message ? (
        <p role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          {message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={pay}
        disabled={!stripe || !ready || paying || !cardName.trim()}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-gold-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {paying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
        {paying ? "Processing…" : `Authorize ${formatAmount(view.amount, view.currency)} & Issue Ticket`}
      </button>
    </div>
  );
}

function TestBanner({ noTicket }: { noTicket: boolean }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      <TestTube2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        TEST MODE: no real money moves. Use Stripe's test card 4242 4242 4242 4242 with any future date and any CVC.
        {noTicket ? " This computer uses live fares, so no ticket will be booked after the test payment." : ""}
      </span>
    </p>
  );
}

function ReturnLink({ label }: { label: string }) {
  const [href, setHref] = useState("/");
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CHECKOUT_RETURN_KEY);
      if (saved?.startsWith("/flight/booking")) setHref(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  return <a href={href} className="rounded-xl bg-gold px-5 py-3 text-sm font-bold text-gold-foreground">{label}</a>;
}

function Notice({ icon, title, body, children }: { icon: React.ReactNode; title: string; body?: string | undefined; children?: React.ReactNode }) {
  return (
    <div className="grid min-h-[70dvh] place-items-center bg-secondary/50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
        <div className="flex justify-center">{icon}</div>
        <h1 className="mt-3 font-display text-2xl font-semibold text-navy">{title}</h1>
        {body ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p> : null}
        {children ? <div className="mt-5 flex justify-center">{children}</div> : null}
      </div>
    </div>
  );
}
