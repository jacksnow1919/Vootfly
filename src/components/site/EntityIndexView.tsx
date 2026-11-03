import { Link } from "@tanstack/react-router";
import { PageShell, Card, SectionTitle } from "@/components/site/ui";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { FlightSearchWidget } from "@/components/site/FlightSearchWidget";
import {
  destinationHubPath,
  originHubPath,
  placeLabel,
  REGION_LABEL,
  type Cabin,
  type Crumb,
  type Place,
} from "@/lib/hierarchy";

export function EntityIndexView({
  cabin,
  title,
  subtitle,
  crumbs,
  gateways,
  destinations,
  show,
  liveIndex,
}: {
  cabin: Cabin;
  title: string;
  subtitle: string;
  crumbs: Crumb[];
  gateways: Place[];
  destinations: Place[];
  show: "both" | "origins" | "destinations";
  /** Live routes and the hubs that have one (29 Oct 2026). When given, hubs with
   * no live route are not linked and every live route page is listed. */
  liveIndex?: { routes: { path: string; from: string; to: string }[]; originHubCodes: string[]; destinationHubCodes: string[] };
}) {
  const originOk = liveIndex ? new Set(liveIndex.originHubCodes) : null;
  const destOk = liveIndex ? new Set(liveIndex.destinationHubCodes) : null;
  const shownGateways = originOk ? gateways.filter((g) => originOk.has(g.code)) : gateways;
  const shownDestinations = destOk ? destinations.filter((d) => destOk.has(d.code)) : destinations;
  const byRegion = new Map<string, Place[]>();
  for (const d of shownDestinations) {
    const r = d.region ?? "other";
    if (!byRegion.has(r)) byRegion.set(r, []);
    byRegion.get(r)!.push(d);
  }
  return (
    <PageShell eyebrow="Flights" title={title} subtitle={subtitle}>
      <Breadcrumbs crumbs={crumbs} className="mb-4" />
      <div className="mb-6">
        <FlightSearchWidget />
      </div>
      <div className="space-y-4">
        {show !== "destinations" ? (
          <Card>
            <SectionTitle>Flights from US gateways</SectionTitle>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {shownGateways.map((g) => (
                <li key={g.code}>
                  <Link to={originHubPath(g.code)} className="text-sm text-primary hover:underline">
                    {placeLabel(g)}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        {show !== "origins"
          ? [...byRegion.entries()].map(([region, list]) => (
              <Card key={region}>
                <SectionTitle>{REGION_LABEL[region] ?? region}</SectionTitle>
                <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                  {list.map((d) => (
                    <li key={d.code}>
                      <Link to={destinationHubPath(d.code, cabin)} className="text-sm text-primary hover:underline">
                        {placeLabel(d)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          : null}
        {liveIndex?.routes.length ? (
          <Card>
            <SectionTitle>Route pages</SectionTitle>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {liveIndex.routes.map((r) => (
                <li key={r.path}>
                  <Link to={r.path} className="text-sm text-primary hover:underline">
                    {r.from} to {r.to}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}
