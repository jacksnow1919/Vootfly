import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/site/ui";
import { getObservedAirlines } from "@/lib/airline-pages.functions";
import { formatMoney } from "@/lib/hierarchy";
import { Plane } from "lucide-react";

/**
 * Real, database-backed replacement for the fabricated version noindexed
 * 2026-09-22 (see sitemap[.]xml.ts). Lists only airlines genuinely
 * observed in a real published fare snapshot -- no fabricated ratings,
 * no invented prices, no airline with zero real data.
 */
export const Route = createFileRoute("/airlines/")({
  loader: () => getObservedAirlines(),
  head: () => ({
    meta: [
      { title: "Airlines We've Seen | VootFly" },
      {
        name: "description",
        content: "Real airlines observed on VootFly's routes, with the lowest fare we've actually seen for each.",
      },
      { property: "og:title", content: "Airlines We've Seen | VootFly" },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: AirlinesIndex,
});

function AirlinesIndex() {
  const airlines = Route.useLoaderData();
  return (
    <PageShell
      eyebrow="Real fare data"
      title="Airlines we've seen"
      subtitle="Every airline below has genuinely appeared in a real fare search on VootFly. Prices are the lowest we've actually observed, not typical or estimated fares."
    >
      {airlines.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {airlines.map((a) => (
            <Link key={a.iata} to="/airlines/$slug" params={{ slug: a.iata.toLowerCase() }}>
              <Card className="h-full transition hover:border-primary">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  <Plane className="size-3.5 text-gold" /> {a.iata}
                </div>
                <p className="mt-1 text-lg font-bold text-navy">{a.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Seen on {a.routesObserved} route{a.routesObserved === 1 ? "" : "s"}
                </p>
                <p className="mt-1 font-display text-xl font-semibold text-navy">
                  From {formatMoney(a.lowestFareSeen, "USD")}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">No airline data recorded yet. Check back soon.</p>
        </Card>
      )}
    </PageShell>
  );
}
