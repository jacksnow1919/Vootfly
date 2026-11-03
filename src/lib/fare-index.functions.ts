/**
 * GEO fare-index research asset (Phase 8).
 *
 * The kind of original data page AI systems have a reason to cite: real
 * lowest fares actually observed by VootFly, not editorial content about
 * flights in general.
 *
 * HONEST SCOPE: as of this build, fare_observations holds real economy
 * data spanning 17-19 Sep 2026, one observation per route so far (W6
 * records one per real refresh). This is presented as a current snapshot,
 * not a historical trend -- claiming a "trend" from one data point per
 * route would not be real. The page states this plainly and will read
 * honestly richer as more real observations accumulate daily.
 */
import { createServerFn } from "@tanstack/react-start";

export type FareIndexRow = {
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  price: number;
  currency: string;
  airline: string | null;
  observedAt: string;
};

export const getFareIndex = createServerFn({ method: "GET" }).handler(async (): Promise<{
  rows: FareIndexRow[];
  routeCount: number;
  observationCount: number;
  earliestObservation: string | null;
  latestObservation: string | null;
}> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getPlaces } = await import("@/lib/seo-pages.functions");

  const { data, error } = await supabaseAdmin
    .from("fare_observations")
    .select("from_code, to_code, price, currency, airline_iata, observed_at")
    .eq("cabin", "economy")
    .order("observed_at", { ascending: false })
    .limit(500);

  if (error || !data) return { rows: [], routeCount: 0, observationCount: 0, earliestObservation: null, latestObservation: null };

  const places = await getPlaces();
  // One row per route: the most recent real observation only, since the
  // point of an "index" is the current state per route, not every
  // historical row on the page.
  const latestByRoute = new Map<string, (typeof data)[number]>();
  for (const r of data) {
    const key = `${r.from_code}|${r.to_code}`;
    if (!latestByRoute.has(key)) latestByRoute.set(key, r);
  }

  const rows: FareIndexRow[] = [...latestByRoute.values()]
    .map((r) => ({
      fromCode: r.from_code,
      toCode: r.to_code,
      fromName: places[r.from_code]?.name ?? r.from_code.toUpperCase(),
      toName: places[r.to_code]?.name ?? r.to_code.toUpperCase(),
      price: Number(r.price),
      currency: r.currency,
      airline: r.airline_iata,
      observedAt: r.observed_at,
    }))
    .sort((a, b) => a.price - b.price);

  const times = data.map((r) => r.observed_at).sort();
  return {
    rows,
    routeCount: rows.length,
    observationCount: data.length,
    earliestObservation: times[0] ?? null,
    latestObservation: times[times.length - 1] ?? null,
  };
});
