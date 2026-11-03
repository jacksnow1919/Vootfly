/**
 * Real, database-backed airline pages -- replaces the fabricated
 * travel-data.ts version (noindexed 2026-09-22; see sitemap[.]xml.ts).
 *
 * Every figure here comes from real PKFARE fare snapshots already stored
 * on published route pages. No rating, no review, no invented price.
 * Cabin amenity claims (seat type, lounge, baggage allowance) are
 * deliberately NOT shown: PKFARE does not reliably supply them, and the
 * comparison engine built earlier in this project already established
 * that baggage must be reported as "unknown" rather than guessed. The
 * same honesty applies here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AirlineSummary = {
  iata: string;
  name: string;
  routesObserved: number;
  lowestFareSeen: number;
};

export type AirlineRouteFare = {
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  amount: number;
  currency: string;
  path: string;
};

export type AirlinePageData = {
  iata: string;
  name: string;
  routes: AirlineRouteFare[];
  lowestFareSeen: number | null;
};

async function realAirlineRows() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("seo_pages")
    .select("path, from_code, to_code, fare_snapshot_json")
    .eq("page_type", "route")
    .eq("status", "published")
    .limit(5000);
  if (error || !data) return [];
  return data;
}

/** Real airlines currently observed in at least one real published fare
 * snapshot, sorted by how many real routes each appears on. Airlines with
 * zero real observations are never listed -- no thin/empty entries. */
export const getObservedAirlines = createServerFn({ method: "GET" }).handler(async (): Promise<AirlineSummary[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pages = await realAirlineRows();
  const places = await (await import("@/lib/seo-pages.functions")).getPlaces();
  void places;

  const byAirline = new Map<string, { routes: Set<string>; lowest: number; name: string }>();
  const { data: airlineRef } = await supabaseAdmin.from("airlines").select("iata_code, name");
  const refByCode = new Map((airlineRef ?? []).map((a) => [a.iata_code, a.name]));
  const refByName = new Map((airlineRef ?? []).map((a) => [a.name, a.iata_code]));

  for (const p of pages) {
    const fares = (p.fare_snapshot_json as { fares?: { airline?: string; airline_code?: string; amount?: number }[] } | null)?.fares ?? [];
    for (const f of fares) {
      const code = f.airline_code || (f.airline ? refByName.get(f.airline) : undefined);
      if (!code || typeof f.amount !== "number") continue;
      const name = refByCode.get(code) ?? f.airline ?? code;
      const entry = byAirline.get(code) ?? { routes: new Set<string>(), lowest: Infinity, name };
      entry.routes.add(`${p.from_code}-${p.to_code}`);
      entry.lowest = Math.min(entry.lowest, f.amount);
      byAirline.set(code, entry);
    }
  }

  return [...byAirline.entries()]
    .map(([iata, v]) => ({ iata, name: v.name, routesObserved: v.routes.size, lowestFareSeen: v.lowest }))
    .sort((a, b) => b.routesObserved - a.routesObserved || a.lowestFareSeen - b.lowestFareSeen);
});

/** Real routes and real lowest fares for one airline, from real published
 * page snapshots. Returns routes: [] (not a 404) when the airline is a
 * real reference entry but has no current real observation, so a stale
 * link degrades honestly instead of erroring. */
export const getAirlinePage = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ iata: z.string().min(2).max(3) }).parse(data))
  .handler(async ({ data }): Promise<AirlinePageData | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const iata = data.iata.toUpperCase();

    const { data: ref } = await supabaseAdmin.from("airlines").select("iata_code, name").eq("iata_code", iata).maybeSingle();
    if (!ref) return null; // not a real airline at all

    const pages = await realAirlineRows();
    const { getPlaces } = await import("@/lib/seo-pages.functions");
    const places = await getPlaces();

    const routes: AirlineRouteFare[] = [];
    let lowest: number | null = null;
    for (const p of pages) {
      const fares = (p.fare_snapshot_json as { fares?: { airline?: string; airline_code?: string; amount?: number; currency?: string }[] } | null)?.fares ?? [];
      const match = fares.find((f) => f.airline_code === iata || f.airline === ref.name);
      if (!match || typeof match.amount !== "number") continue;
      routes.push({
        fromCode: p.from_code!,
        toCode: p.to_code!,
        fromName: places[p.from_code!]?.name ?? p.from_code!,
        toName: places[p.to_code!]?.name ?? p.to_code!,
        amount: match.amount,
        currency: match.currency ?? "USD",
        path: p.path,
      });
      lowest = lowest === null ? match.amount : Math.min(lowest, match.amount);
    }
    routes.sort((a, b) => a.amount - b.amount);
    return { iata, name: ref.name, routes, lowestFareSeen: lowest };
  });
