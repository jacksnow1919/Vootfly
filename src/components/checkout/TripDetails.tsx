import type { ReactNode } from "react";
import { Plane } from "lucide-react";
import { formatAmount, formatStamp, type TripCondition, type TripSnapshot } from "@/lib/checkout-shared";

const stopsLabel = (stops: number) => (stops === 0 ? "Non-stop" : stops === 1 ? "1 stop" : `${stops} stops`);

/** Only what the airline's offer states. Anything it leaves out says so, rather than being guessed. */
const conditionLabel = (c: TripCondition) =>
  c.allowed === null
    ? "Not stated by the airline"
    : c.allowed
      ? c.penalty
        ? `Allowed, airline penalty ${c.penalty}`
        : "Allowed"
      : "Not allowed";

export function TripDetails({ trip }: { trip: TripSnapshot }) {
  return (
    <div className="space-y-3">
      {trip.slices.map((slice, i) => (
        <div key={`${slice.origin}-${slice.departAt}`} className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {trip.slices.length === 1 ? "Flight" : i === 0 ? "Outbound" : "Return"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-display text-lg font-semibold text-navy">
            {slice.origin} <Plane className="size-4 text-mutedblue" aria-hidden="true" /> {slice.destination}
          </div>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <DetailRow label="Departs" value={formatStamp(slice.departAt)} />
            <DetailRow label="Arrives" value={formatStamp(slice.arriveAt)} />
            <DetailRow label="Duration" value={`${slice.duration}, ${stopsLabel(slice.stops)}`} />
            {slice.cabin ? <DetailRow label="Cabin" value={slice.cabin} /> : null}
          </dl>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {slice.segments.map((seg) => (
              <li key={`${seg.flightNo}-${seg.departAt}`}>
                {seg.carrier} {seg.flightNo}: {seg.origin} to {seg.destination}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <dl className="grid gap-x-6 gap-y-1 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">
        <DetailRow label="Cabin bags" value={trip.cabinBags === null ? "Not stated by the airline" : `${trip.cabinBags} per traveller`} />
        <DetailRow label="Checked bags" value={trip.checkedBags === null ? "Not stated by the airline" : `${trip.checkedBags} per traveller`} />
        <DetailRow label="Refund before departure" value={conditionLabel(trip.refund)} />
        <DetailRow label="Changes before departure" value={conditionLabel(trip.change)} />
      </dl>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:block">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-navy sm:text-left">{value}</dd>
    </div>
  );
}

/** Fare and taxes appear only when the offer states them; the total is always the airline's. */
export function FareSummary({
  title,
  base,
  tax,
  total,
  currency,
  travellers,
  footer,
}: {
  title: string;
  base: string | null;
  tax: string | null;
  total: string;
  currency: string;
  travellers: number;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-navy text-navy-foreground shadow-lux">
      <div className="border-b border-white/10 p-5">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-navy-foreground/60">
          {travellers} traveller{travellers === 1 ? "" : "s"}. Price checked with the airline.
        </p>
      </div>
      <dl className="space-y-3 p-5 text-sm">
        {base ? <SummaryRow label="Fare" value={formatAmount(base, currency)} /> : null}
        {tax ? <SummaryRow label="Taxes and fees" value={formatAmount(tax, currency)} /> : null}
        <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
          <dt className="text-xs uppercase tracking-widest text-navy-foreground/60">Total</dt>
          <dd className="font-display text-2xl font-semibold text-gold">{formatAmount(total, currency)}</dd>
        </div>
      </dl>
      {footer ? <div className="p-5 pt-0 text-[11px] text-navy-foreground/60">{footer}</div> : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-widest text-navy-foreground/60">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

/** The same service fees /refund-policy states. No other VootFly fee exists in the booking code. */
export function ServiceFeeNote() {
  return (
    <div className="rounded-lg border border-white/10 p-3 leading-relaxed">
      <p className="font-semibold text-navy-foreground/80">VootFly service fees</p>
      <p className="mt-1">
        The total above is what you pay today. After a ticket is issued, our service fee is USD 50 per passenger for a
        change and USD 75 per passenger for a cancellation, plus any airline charges.{" "}
        <a href="/refund-policy" className="font-semibold text-gold underline">
          Refund &amp; Cancellation Policy
        </a>
      </p>
    </div>
  );
}
