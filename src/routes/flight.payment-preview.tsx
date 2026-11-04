import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CreditCard, Info, Lock, Plane, ShieldCheck } from "lucide-react";
import { Steps } from "@/components/site/ui";
import { currencySymbol, parseFlightSearch } from "@/lib/flight-search-params";

export const Route = createFileRoute("/flight/payment-preview")({
  validateSearch: parseFlightSearch,
  head: () => ({
    meta: [
      { title: "Payment Page Preview | VootFly" },
      { name: "description", content: "Preview of the VootFly card payment page. Card payment is not switched on yet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentPreview,
});

/**
 * The look of the card step, with no payment provider behind it. The fields are switched off and
 * have no name, so nothing can be typed or sent. When a provider is chosen, its secure fields go
 * in these same places, so a card number never passes through VootFly's own code.
 */
function CardField({ id, label, placeholder, className = "" }: { id: string; label: string; placeholder: string; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-widest text-navy-foreground/70">
        {label}
      </label>
      <input
        id={id}
        disabled
        autoComplete="off"
        placeholder={placeholder}
        className="mt-1 w-full cursor-not-allowed rounded-xl border border-gold/30 bg-white/5 px-3 py-2.5 text-sm text-navy-foreground placeholder:text-navy-foreground/50"
      />
    </div>
  );
}

function PaymentPreview() {
  const search = Route.useSearch();
  const travellers = Number(search.passengers ?? "1");
  const perPerson = Number(search.price);
  const hasFare = Number.isFinite(perPerson) && perPerson > 0;
  const sym = currencySymbol(search.currency);
  const money = (n: number) => `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const total = perPerson * travellers;

  return (
    <div className="min-h-[100dvh] bg-secondary/50 px-4 py-6 pb-24">
      <div className="mx-auto max-w-7xl space-y-4">
        <Steps current={5} />
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Preview only. Card payment isn't switched on yet, so this page can't take a card or charge anyone.</span>
        </p>
      </div>

      <div className="mx-auto mt-4 grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl bg-navy p-4 text-navy-foreground shadow-lux sm:p-6">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Lock className="size-5 text-gold" aria-hidden="true" /> Secure Payment
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
            <CreditCard className="size-4 text-gold" aria-hidden="true" /> Credit or debit card
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <CardField id="preview-card-number" label="Card Number" placeholder="1234 5678 9012 3456" className="col-span-2" />
            <CardField id="preview-card-expiry" label="Expiry Date" placeholder="MM / YY" />
            <CardField id="preview-card-cvc" label="CVC" placeholder="123" />
            <CardField id="preview-card-name" label="Name on Card" placeholder="As printed on the card" className="col-span-2" />
            <CardField id="preview-card-postal" label="Billing Postal Code" placeholder="10001" className="col-span-2" />
          </div>

          <button
            type="button"
            disabled
            className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-bold text-gold-foreground opacity-60"
          >
            <Lock className="size-4" aria-hidden="true" />
            {hasFare ? `Authorize ${money(total)} & Issue Ticket` : "Authorize & Issue Ticket"}
          </button>

          <ul className="mt-3 space-y-1.5 text-xs text-navy-foreground/70">
            <li className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
              When switched on, your card details go directly to our payment provider. VootFly never stores your card number or CVC.
            </li>
            <li className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
              Your card is held first and only charged once the airline confirms your booking.
            </li>
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
              This button stays off until a payment provider is connected.
            </li>
          </ul>

          <Link
            to="/flight/booking"
            search={search}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-navy-foreground/70 hover:text-navy-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to booking
          </Link>
        </section>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-navy text-navy-foreground shadow-lux">
            <div className="border-b border-white/10 p-5">
              <h2 className="font-display text-lg font-semibold">Price Summary</h2>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
                {search.origin} <Plane className="size-3.5" aria-hidden="true" /> {search.destination}
              </p>
              <p className="mt-1 text-xs text-navy-foreground/60">
                {search.airline} {search.flightNo}, {search.cabin}, {search.departDate}
                {search.returnDate ? ` to ${search.returnDate}` : ""}
              </p>
            </div>
            <dl className="space-y-3 p-5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs uppercase tracking-widest text-navy-foreground/60">Travellers</dt>
                <dd className="font-semibold">{travellers}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
                <dt className="text-xs uppercase tracking-widest text-navy-foreground/60">Total</dt>
                <dd className="font-display text-2xl font-semibold text-gold">{hasFare ? money(total) : "No fare selected"}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
