import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/site/ui";
import { getFareIndex } from "@/lib/fare-index.functions";
import { formatMoney } from "@/lib/hierarchy";
import { airlineName } from "@/lib/airline-names";

/**
 * VootFly Fare Index -- a GEO research asset built from real observed
 * fares (fare_observations, economy only), not editorial content. See
 * fare-index.functions.ts for the honest scope note on current data depth.
 */
export const Route = createFileRoute("/research/fare-index")({
  loader: () => getFareIndex(),
  head: () => ({
    meta: [
      { title: "VootFly Fare Index: Real Observed Economy Fares" },
      {
        name: "description",
        content: "VootFly's own fare index: real economy fares we have observed on US-origin long-haul routes, updated as we record new data.",
      },
      { property: "og:title", content: "VootFly Fare Index" },
      { property: "og:description", content: "Real observed economy fares, not editorial estimates." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: FareIndexPage,
});

function FareIndexPage() {
  const { rows, routeCount, observationCount, earliestObservation, latestObservation } = Route.useLoaderData();
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded");

  return (
    <PageShell title="VootFly Fare Index" subtitle="Real economy fares we have actually observed, not editorial estimates.">
      <Card>
        <p className="text-sm text-muted-foreground">
          This index is built entirely from fares VootFly's own systems have observed on real searches. Every price below was
          seen on a real query to our flight data provider; none are estimated, typical, or historical averages.
        </p>
        {routeCount > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Currently tracking <b>{routeCount}</b> route{routeCount === 1 ? "" : "s"} from <b>{observationCount}</b> real observation
            {observationCount === 1 ? "" : "s"} recorded between {fmtDate(earliestObservation)} and {fmtDate(latestObservation)}. This
            index updates as VootFly records more real fares daily; it currently reflects a recent snapshot rather than a long
            historical trend.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No real fare observations are recorded yet. Check back soon.</p>
        )}
      </Card>

      {rows.length ? (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="py-2">Route</th>
                <th className="py-2">Lowest fare observed</th>
                <th className="py-2">Airline</th>
                <th className="py-2">Observed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.fromCode}-${r.toCode}`} className="border-b border-border/60">
                  <td className="py-2 font-medium text-navy">
                    {r.fromName} → {r.toName}
                  </td>
                  <td className="py-2 font-bold">{formatMoney(r.price, r.currency)}</td>
                  <td className="py-2 text-muted-foreground">{r.airline ? airlineName(r.airline) : "Not listed"}</td>
                  <td className="py-2 text-muted-foreground">{fmtDate(r.observedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Card>
        <p className="text-xs text-muted-foreground">
          Fares are per person, subject to availability and change, and reflect a single point-in-time observation rather than a
          guaranteed current price. VootFly advisors confirm final availability before any booking is completed.
        </p>
      </Card>
    </PageShell>
  );
}
