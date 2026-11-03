import { Card } from "@/components/site/ui";
import { formatMoney, snapshotIsFresh, type FareSnapshot as Snapshot, type Cabin } from "@/lib/hierarchy";
import { airlineName } from "@/lib/airline-names";

const FARE_DISCLAIMER =
  "Fares shown are the lowest found at the time of the snapshot, per person, and are subject to availability and change at the time of booking.";

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Renders a real fare snapshot. If there is no snapshot, it says so and offers a live search;
 * it never shows a placeholder number.
 */
export function FareSnapshot({
  snapshot,
  fromName,
  toName,
  fromIata,
  toIata,
  cabin,
}: {
  snapshot: Snapshot | null;
  fromName: string;
  toName: string;
  fromIata: string | null;
  toIata: string | null;
  cabin: Cabin;
}) {
  const fresh = snapshotIsFresh(snapshot?.fetched_at);
  const searchHref =
    fromIata && toIata ? `/flight/search?origin=${fromIata}&destination=${toIata}&cabin=${cabin}` : "/flight/search";

  if (!snapshot?.lowest) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">
          We do not have a recent fare on file for {fromName} to{" "}
          {toName}. Run a live search for today's availability.
        </p>
        <a href={searchHref} className="mt-3 inline-flex text-sm font-semibold text-primary">
          Search live fares
        </a>
      </Card>
    );
  }

  const l = snapshot.lowest;
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Lowest fare found</p>
          <p className="font-display text-3xl font-semibold text-navy">{formatMoney(l.amount, l.currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {airlineName(l.airline ?? l.airline_code) ? `${airlineName(l.airline ?? l.airline_code)} · ` : ""}
            {l.depart_date ? `departing ${formatDate(l.depart_date)}` : ""}
            {l.return_date ? ` · returning ${formatDate(l.return_date)}` : ""}
          </p>
        </div>
        <a
          href={searchHref}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Check live availability
        </a>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Snapshot {formatDate(snapshot.fetched_at)}
        {fresh ? "" : " (older than 7 days, verify with a live search)"}. {FARE_DISCLAIMER}
      </p>
      {snapshot.by_month?.length ? (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Lowest fare by month</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {snapshot.by_month.map((m) => (
              <div key={m.month} className="rounded-lg border border-border p-2 text-center">
                <p className="text-xs text-muted-foreground">{m.month}</p>
                <p className="text-sm font-semibold text-navy">{formatMoney(m.lowest, m.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
