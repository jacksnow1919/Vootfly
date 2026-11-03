import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { PageShell, Card, SectionTitle } from "@/components/site/ui";
import { getAirlinePage } from "@/lib/airline-pages.functions";
import { formatMoney } from "@/lib/hierarchy";
import { Plane } from "lucide-react";

/**
 * Real, database-backed replacement for the fabricated version noindexed
 * 2026-09-22 (see sitemap[.]xml.ts). No rating, no review, no cabin/
 * baggage claim PKFARE cannot reliably supply -- same honesty the
 * comparison engine already established for those fields. Every fare
 * shown is a real amount from a real published page's snapshot.
 */
/**
 * Old slugs from the fabricated travel-data.ts version (live and crawlable
 * until 2026-09-22). 301 them to the real IATA-code pages so any link or
 * crawl history carries over, instead of erroring.
 */
const LEGACY_SLUGS: Record<string, string> = {
  emirates: "ek",
  "qatar-airways": "qr",
  lufthansa: "lh",
  "turkish-airlines": "tk",
  "singapore-airlines": "sq",
};

export const Route = createFileRoute("/airlines/$slug")({
  loader: async ({ params }) => {
    const slug = params.slug.toLowerCase();
    const legacy = LEGACY_SLUGS[slug];
    if (legacy) throw redirect({ href: `/airlines/${legacy}`, statusCode: 301 });
    // FIXED 2026-09-22: anything that is not a 2-3 character code previously
    // reached getAirlinePage's input validator, which threw, and the page
    // returned a 500 server error (confirmed live on /airlines/emirates).
    // Unknown or malformed slugs are now a clean 404.
    if (!/^[a-z0-9]{2,3}$/.test(slug)) throw notFound();
    const page = await getAirlinePage({ data: { iata: slug } });
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Airline not found" }, { name: "robots", content: "noindex" }] };
    const { name, iata, routes, lowestFareSeen } = loaderData.page;
    const title = `${name} (${iata}) Flights & Fares | VootFly`;
    const description =
      routes.length && lowestFareSeen
        ? `Real fares we've seen for ${name}: from ${formatMoney(lowestFareSeen, "USD")} across ${routes.length} route${routes.length === 1 ? "" : "s"}.`
        : `${name} (${iata}) on VootFly. No real fare data recorded yet for this carrier.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        // Genuinely empty pages (a real reference airline with zero
        // current real observations) stay noindexed rather than being
        // shown as content-bearing to Google.
        { name: "robots", content: routes.length ? "index,follow" : "noindex,nofollow" },
      ],
    };
  },
  component: AirlinePage,
  notFoundComponent: () => (
    <PageShell title="Airline not found" subtitle="We don't have data on that carrier.">
      <Link to="/airlines" className="font-semibold text-navy underline">
        Back to all airlines
      </Link>
    </PageShell>
  ),
});

function AirlinePage() {
  const { page } = Route.useLoaderData();
  return (
    <PageShell
      eyebrow={page.iata}
      title={page.name}
      subtitle={
        page.routes.length
          ? `Real fares VootFly has observed for ${page.name}, lowest first.`
          : `No real fare data recorded yet for ${page.name}.`
      }
    >
      {page.routes.length ? (
        <Card>
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <Plane className="size-4 text-gold" /> Routes we've seen {page.name} on
            </span>
          </SectionTitle>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="py-2">Route</th>
                <th className="py-2">Lowest fare seen</th>
              </tr>
            </thead>
            <tbody>
              {page.routes.map((r) => (
                <tr key={`${r.fromCode}-${r.toCode}`} className="border-b border-border/60">
                  <td className="py-2">
                    <Link to={r.path} className="font-medium text-navy hover:text-primary">
                      {r.fromName} → {r.toName}
                    </Link>
                  </td>
                  <td className="py-2 font-bold">{formatMoney(r.amount, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground">
            {page.name} is a real airline in our reference data, but we haven't observed a current fare for them on any
            published route yet.
          </p>
        </Card>
      )}
      <Card>
        <p className="text-xs text-muted-foreground">
          Fares are per person, subject to availability and change, and reflect the lowest amount VootFly has actually seen
          in a real search. VootFly advisors confirm final availability before any booking is completed.
        </p>
      </Card>
    </PageShell>
  );
}
