import { Link } from "@tanstack/react-router";
import { PageShell, Card, SectionTitle } from "@/components/site/ui";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { FlightSearchWidget } from "@/components/site/FlightSearchWidget";
import { airlineName } from "@/lib/airline-names";
import {
  destinationHubPath,
  formatMoney,
  originHubPath,
  placeLabel,
  snapshotIsFresh,
  type Cabin,
  type Crumb,
  type FareSnapshot,
  type Place,
  type PlaceMap,
} from "@/lib/hierarchy";

type Summary = {
  path: string;
  from_code: string | null;
  to_code: string | null;
  cabin: string;
  fare_snapshot_json: unknown;
  fare_snapshot_at: string | null;
};

/**
 * Hub pages (country / metro / airport level) used to render almost nothing:
 * a search widget, a list of route links, and a sidebar. That thinness is
 * what made them worth excluding from the sitemap (2026-09-16) and is the
 * same reason Google left them in "Discovered - currently not indexed".
 *
 * Enriched 2026-09-16 with real, already-available data ONLY. Every figure
 * below is derived from the route fare snapshots this component is already
 * given (real PKFARE data, already public on the route pages themselves) or
 * from the places reference table. Nothing is fetched, estimated, averaged
 * into a claim the data doesn't support, or invented:
 *   - airlines        -> distinct real carriers in real fare snapshots
 *   - lowest fare     -> a real observed amount, with the real airline
 *   - airports        -> real rows in the places hierarchy
 *   - FAQs            -> generated from those same real values, never prose
 *                        about weather/visas/transport, which VootFly has no
 *                        trustworthy source for
 *   - freshness       -> the real fare_snapshot_at, shown as a date
 *
 * A hub with no real routes still gets the honest short message it had
 * before -- it is deliberately NOT padded with filler to look substantial.
 */
export function HubPageView({
  side,
  cabin,
  place,
  crumbs,
  children,
  routes,
  places,
}: {
  side: "origin" | "destination";
  cabin: Cabin;
  place: Place;
  crumbs: Crumb[];
  children: Place[];
  routes: Summary[];
  places: PlaceMap;
}) {
  const title =
    side === "origin" ? `Flights from ${placeLabel(place)}` : `Flights to ${placeLabel(place)}`;
  const direction = side === "origin" ? "from" : "to";

  // Group routes by the other end's country for a scannable hub (F5).
  const groups = new Map<string, { country: Place | undefined; items: { s: Summary; other: Place | undefined }[] }>();
  for (const s of routes) {
    const otherCode = side === "origin" ? s.to_code : s.from_code;
    const other = otherCode ? places[otherCode] : undefined;
    const countryCode = other?.country_code ?? "other";
    if (!groups.has(countryCode)) groups.set(countryCode, { country: places[countryCode], items: [] });
    groups.get(countryCode)!.items.push({ s, other });
  }

  const childLabel =
    place.level === "country" ? "States and cities" : place.level === "state" ? "Cities" : place.level === "metro" ? "Airports" : "";

  /* ---------------------------------------------------------------------
   * Real, derived-only stats. No new data source, no invented values.
   * ------------------------------------------------------------------- */
  const snapshots = routes
    .map((r) => r.fare_snapshot_json as FareSnapshot | null)
    .filter((s): s is FareSnapshot => !!s);

  // Cheapest genuinely observed fare across this hub's routes.
  let cheapest: { amount: number; currency: string; airline?: string | undefined; path?: string | undefined } | null = null;
  for (const r of routes) {
    const low = (r.fare_snapshot_json as FareSnapshot | null)?.lowest;
    if (!low || typeof low.amount !== "number") continue;
    if (!cheapest || low.amount < cheapest.amount) {
      cheapest = { amount: low.amount, currency: low.currency, airline: airlineName(low.airline ?? low.airline_code) || undefined, path: r.path };
    }
  }

  // Distinct real carriers seen in real fare data, each with the lowest real
  // amount they were actually observed at. Never a claimed route network.
  const airlineLowest = new Map<string, { name: string; amount: number; currency: string }>();
  for (const snap of snapshots) {
    for (const f of snap.fares ?? []) {
      const name = airlineName(f.airline ?? f.airline_code);
      if (!name || typeof f.amount !== "number") continue;
      const existing = airlineLowest.get(name);
      if (!existing || f.amount < existing.amount) {
        airlineLowest.set(name, { name, amount: f.amount, currency: f.currency });
      }
    }
  }
  const airlines = [...airlineLowest.values()].sort((a, b) => a.amount - b.amount);

  // Real airports in the places hierarchy under this place (or this place
  // itself when it already is an airport).
  const airports =
    place.level === "airport"
      ? [place]
      : Object.values(places)
          .filter((p) => p.level === "airport" && (p.parent_code === place.code || places[p.parent_code ?? ""]?.parent_code === place.code))
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  // Most recent real snapshot timestamp across this hub's routes.
  const latestSnapshotAt = routes
    .map((r) => r.fare_snapshot_at)
    .filter((t): t is string => !!t)
    .sort()
    .pop();
  const fresh = snapshotIsFresh(latestSnapshotAt);

  const hasRealData = routes.length > 0 && (cheapest !== null || airlines.length > 0);

  /* FAQs built strictly from the real values above. If a value isn't real
   * and present, its question simply isn't asked -- rather than answered
   * with a guess. */
  const faqs: { q: string; a: string }[] = [];
  if (cheapest) {
    faqs.push({
      q: `What is the lowest fare we have found ${direction} ${place.name}?`,
      a: `The lowest fare in our most recent data is ${formatMoney(cheapest.amount, cheapest.currency)} per person${
        cheapest.airline ? ` on ${cheapest.airline}` : ""
      }. Fares are per person and subject to availability and change.`,
    });
  }
  if (airlines.length) {
    faqs.push({
      q: `Which airlines fly ${direction} ${place.name}?`,
      a: `Our recent fare data shows ${airlines.map((a) => a.name).join(", ")}. Other carriers may also serve these routes on dates we have not recently searched.`,
    });
  }
  if (routes.length) {
    faqs.push({
      q: `How many routes does VootFly cover ${direction} ${place.name}?`,
      a: `We currently have ${routes.length} route ${routes.length === 1 ? "page" : "pages"} ${direction} ${place.name}, each with real fare data from our flight provider.`,
    });
  }
  if (airports.length) {
    faqs.push({
      q: `Which airports serve ${place.name}?`,
      a: `${airports.map((a) => `${a.name}${a.iata ? ` (${a.iata.toUpperCase()})` : ""}`).join(", ")}.`,
    });
  }
  if (latestSnapshotAt) {
    faqs.push({
      q: `How current are these fares?`,
      a: `The fares shown were last checked with our flight provider on ${new Date(latestSnapshotAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. Use the search above for live availability.`,
    });
  }

  const faqLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <PageShell eyebrow={side === "origin" ? "Flights from" : "Flights to"} title={title}>
      {faqLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      ) : null}

      <Breadcrumbs crumbs={crumbs} className="mb-4" />

      {hasRealData && cheapest ? (
        <Card className="mb-4">
          <p className="text-sm text-navy">
            The lowest fare we have found {direction} {placeLabel(place)} is{" "}
            <span className="font-bold">{formatMoney(cheapest.amount, cheapest.currency)}</span>
            {cheapest.airline ? ` on ${cheapest.airline}` : ""}, across {routes.length} route
            {routes.length === 1 ? "" : "s"} and {airlines.length} airline{airlines.length === 1 ? "" : "s"} in our recent
            data.
          </p>
        </Card>
      ) : null}

      <div className="mb-6">
        <FlightSearchWidget
          defaultOrigin={side === "origin" ? (place.iata ?? (place.level === "metro" ? place.code.toUpperCase() : undefined)) : undefined}
          defaultDestination={side === "destination" ? (place.iata ?? (place.level === "metro" ? place.code.toUpperCase() : undefined)) : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {routes.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                Route pages {direction} {place.name} are being prepared. Use the search above for live fares.
              </p>
            </Card>
          ) : null}

          {[...groups.entries()].map(([code, g]) => (
            <Card key={code}>
              <SectionTitle>{g.country?.name ?? "Other"}</SectionTitle>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {g.items.map(({ s, other }) => {
                  const snap = s.fare_snapshot_json as FareSnapshot | null;
                  const low = snap?.lowest;
                  return (
                    <li key={s.path}>
                      <Link to={s.path} className="text-sm text-primary hover:underline">
                        {side === "origin"
                          ? `${place.name} to ${other ? placeLabel(other) : s.to_code}`
                          : `${other ? placeLabel(other) : s.from_code} to ${place.name}`}
                        {low ? <span className="text-muted-foreground"> from {formatMoney(low.amount, low.currency)}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}

          {airlines.length ? (
            <Card>
              <SectionTitle>Airlines we have seen {direction} {place.name}</SectionTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Carriers that appeared in our recent fare data, with the lowest fare each was found at. Other airlines may
                also serve these routes.
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {airlines.map((a) => (
                  <li key={a.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-navy">{a.name}</span>
                    <span className="font-semibold text-navy">{formatMoney(a.amount, a.currency)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {hasRealData ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cheapest ? (
                <Card>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Lowest fare found</p>
                  <p className="mt-1 text-lg font-bold text-navy">
                    {formatMoney(cheapest.amount, cheapest.currency)}
                  </p>
                  {cheapest.airline ? <p className="text-xs text-muted-foreground">{cheapest.airline}</p> : null}
                </Card>
              ) : null}
              <Card>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Routes covered</p>
                <p className="mt-1 text-lg font-bold text-navy">{routes.length}</p>
                <p className="text-xs text-muted-foreground">with real fare data</p>
              </Card>
              {airlines.length ? (
                <Card>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Airlines seen</p>
                  <p className="mt-1 text-lg font-bold text-navy">{airlines.length}</p>
                  <p className="text-xs text-muted-foreground">in recent fare data</p>
                </Card>
              ) : null}
              {airports.length ? (
                <Card>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Airports</p>
                  <p className="mt-1 text-lg font-bold text-navy">{airports.length}</p>
                  <p className="text-xs text-muted-foreground">serving {place.name}</p>
                </Card>
              ) : null}
            </div>
          ) : null}

          {faqs.length ? (
            <Card>
              <SectionTitle>Frequently asked questions</SectionTitle>
              <div className="mt-3 space-y-4">
                {faqs.map((f) => (
                  <div key={f.q}>
                    <p className="text-sm font-semibold text-navy">{f.q}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          {children.length ? (
            <Card>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{childLabel}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {children.map((c) => (
                  <li key={c.code}>
                    <Link
                      to={side === "origin" ? originHubPath(c.code) : destinationHubPath(c.code, cabin)}
                      className="text-primary hover:underline"
                    >
                      {placeLabel(c)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {airports.length && place.level !== "airport" ? (
            <Card>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Airports</p>
              <ul className="mt-2 space-y-1 text-sm">
                {airports.map((a) => (
                  <li key={a.code}>
                    <Link
                      to={side === "origin" ? originHubPath(a.code) : destinationHubPath(a.code, cabin)}
                      className="text-primary hover:underline"
                    >
                      {a.name}
                      {a.iata ? ` (${a.iata.toUpperCase()})` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {latestSnapshotAt ? (
            <Card>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Fare data</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Last checked {new Date(latestSnapshotAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                {fresh ? "" : " (search above for current availability)"}.
              </p>
            </Card>
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}
