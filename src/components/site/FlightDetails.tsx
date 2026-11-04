import { useState, type ReactNode } from "react";
import { ChevronDown, Clock, Luggage, Plane } from "lucide-react";
import { airports } from "@/lib/airports";
import type { PkfareNormalisedFare } from "@/lib/pkfare-types";
import type { SupplierSegment } from "@/lib/supplier-segments";

const TABS = ["Flight Information", "Fare Details", "Baggage", "Cancellation & Changes"] as const;
type Tab = (typeof TABS)[number];

const NOT_STATED = "Not stated by the airline. Please confirm before booking.";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const airportLabel = (code: string) => {
  const airport = airports.find((a) => a.code === code);
  return airport ? `${airport.city}, ${airport.name}` : code;
};

/** Supplier times are local to each airport ("2026-11-20T04:55:00"), so they are read as written. */
function clock(stamp: string | null) {
  const m = stamp ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(stamp) : null;
  if (!m) return null;
  const hour = Number(m[4]);
  return {
    time: `${((hour + 11) % 12) + 1}:${m[5]} ${hour < 12 ? "AM" : "PM"}`,
    date: `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`,
  };
}

/** Arrival and the next departure are at the same airport, so both clocks share a time zone. */
function layoverLabel(arrival: string | null, departure: string | null) {
  if (!arrival || !departure) return null;
  const minutes = Math.round((Date.parse(`${departure}Z`) - Date.parse(`${arrival}Z`)) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function Stop({ stamp, code }: { stamp: string | null; code: string }) {
  const c = clock(stamp);
  return (
    <div className="min-w-0">
      <p className="font-display text-base font-semibold text-navy">
        {c?.time ?? "Time not stated"} <span className="text-muted-foreground">{code}</span>
      </p>
      {c ? <p className="text-xs text-muted-foreground">{c.date}</p> : null}
      <p className="text-xs text-muted-foreground">{airportLabel(code)}</p>
    </div>
  );
}

function Journey({ title, segments, fallback }: { title: string; segments?: SupplierSegment[] | undefined; fallback: string }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h4>
      {segments?.length ? (
        <ol className="mt-2 space-y-2">
          {segments.map((seg, i) => {
            const next = segments[i + 1];
            const wait = next ? layoverLabel(seg.arrival_time, next.departure_time) : null;
            return (
              <li key={`${seg.flight_number}-${seg.departure_time}`}>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-navy">
                    <Plane className="size-3.5 text-gold" aria-hidden="true" />
                    {seg.carrier_name && seg.carrier_name !== seg.carrier ? `${seg.carrier_name} ` : ""}
                    {seg.flight_number ?? seg.carrier}
                    {seg.aircraft ? <span className="font-normal text-muted-foreground">· {seg.aircraft}</span> : null}
                  </p>
                  {seg.operating_carrier ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Operated by {seg.operating_carrier}</p>
                  ) : null}
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <Stop stamp={seg.departure_time} code={seg.origin} />
                    <Stop stamp={seg.arrival_time} code={seg.destination} />
                  </div>
                </div>
                {next ? (
                  <p className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-semibold text-navy">
                    <Clock className="size-3" aria-hidden="true" />
                    Change of planes{wait ? `, ${wait} layover` : ""} in {airportLabel(seg.destination).split(",")[0]}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-2 rounded-lg border border-border bg-card p-3 text-sm text-navy">{fallback}</p>
      )}
    </div>
  );
}

function Line({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-navy">{value}</dd>
    </div>
  );
}

const bagLabel = (count: number | undefined) =>
  count === undefined ? NOT_STATED : count === 0 ? "Not included" : `${count} per traveller`;

const ruleLabel = (allowed: boolean | undefined, yes: string, no: string) =>
  allowed === undefined ? NOT_STATED : allowed ? yes : no;

/**
 * Step-by-step flight details for a search result. Shows only what the supplier sent for
 * this fare: anything it left out says so, rather than being filled in.
 */
export function FlightDetails({
  fare,
  passengers,
  renderPrice,
}: {
  fare: PkfareNormalisedFare;
  passengers: number;
  renderPrice: (amount: number) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("Flight Information");
  const terms = fare.terms;

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs font-bold text-primary"
      >
        Flight Details
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="border-t border-border bg-secondary/30 p-3 sm:p-4">
          <div role="tablist" aria-label="Flight details" className="flex gap-1 overflow-x-auto pb-1">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  tab === name ? "bg-primary text-primary-foreground" : "text-navy hover:bg-secondary"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-3" role="tabpanel">
            {tab === "Flight Information" ? (
              <div className="space-y-4">
                <Journey
                  title={`Outbound: ${fare.origin} to ${fare.destination}, ${fare.duration}`}
                  segments={fare.segments}
                  fallback={`${fare.airline} ${fare.flightNo}, departs ${fare.departTime}, arrives ${fare.arriveTime}. The airline didn't send flight-by-flight detail for this fare.`}
                />
                {fare.returnFlight ? (
                  <Journey
                    title={`Return: ${fare.returnFlight.origin} to ${fare.returnFlight.destination}, ${fare.returnFlight.duration}`}
                    segments={fare.returnFlight.segments}
                    fallback={`${fare.returnFlight.airline} ${fare.returnFlight.flightNo}, departs ${fare.returnFlight.departTime}, arrives ${fare.returnFlight.arriveTime}. The airline didn't send flight-by-flight detail for this fare.`}
                  />
                ) : null}
              </div>
            ) : null}

            {tab === "Fare Details" ? (
              <dl className="divide-y divide-border rounded-lg border border-border bg-card px-3">
                <Line label="Fare per person, incl. taxes" value={renderPrice(fare.price)} />
                {passengers > 1 ? (
                  <Line
                    label={`Total for ${passengers} travellers`}
                    value={renderPrice(fare.totalPrice ?? fare.price * passengers)}
                  />
                ) : null}
                <Line label="Cabin" value={fare.cabin} />
                {terms?.brand ? <Line label="Fare type" value={terms.brand} /> : null}
              </dl>
            ) : null}

            {tab === "Baggage" ? (
              <dl className="divide-y divide-border rounded-lg border border-border bg-card px-3">
                <Line
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Luggage className="size-3.5" aria-hidden="true" /> Cabin bags
                    </span>
                  }
                  value={bagLabel(terms?.baggage?.cabin_bags)}
                />
                <Line
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Luggage className="size-3.5" aria-hidden="true" /> Checked bags
                    </span>
                  }
                  value={bagLabel(terms?.baggage?.checked_bags)}
                />
              </dl>
            ) : null}

            {tab === "Cancellation & Changes" ? (
              <div className="space-y-2">
                <dl className="divide-y divide-border rounded-lg border border-border bg-card px-3">
                  <Line label="Refund before departure" value={ruleLabel(terms?.refundable, "Allowed", "Not allowed")} />
                  <Line label="Changes before departure" value={ruleLabel(terms?.changeable, "Allowed", "Not allowed")} />
                </dl>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Airline charges may apply. After a ticket is issued, our service fee is USD 50 per passenger for a
                  change and USD 75 per passenger for a cancellation.{" "}
                  <a href="/refund-policy" className="font-semibold text-navy underline">
                    Refund &amp; Cancellation Policy
                  </a>
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
