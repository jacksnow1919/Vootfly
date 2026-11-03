/**
 * Airline Intelligence — Phase 3 Foundation.
 *
 * Combines the real `airlines` reference table (Phase 1, static/verified
 * data -- real IATA codes and names) with real, observed route
 * associations from entity_relationships (Phase 1 Knowledge Graph
 * foundation, populated in Phase 3 only from real fare_observations --
 * never an assumed or invented network). Clearly separates the two: the
 * airline's own identity is static reference data; which routes it's been
 * observed on is live-derived and comes with real observation timestamps.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AirlineIntelligenceReport = {
  iataCode: string;
  /** Null if this IATA code isn't in the reference table at all. */
  airline: { name: string; icaoCode: string | null; countryCode: string | null; alliance: string | null } | null;
  dataSourceForIdentity: "airlines (static reference table)";
  /** Routes this airline has a real, observed fare on -- not a claimed
   * network, only what's actually been seen in real fare data. Empty
   * array (not null) when nothing has been observed yet. */
  observedRoutes: { route: string; lowestObservedPrice: number; currency: string; observedAt: string }[];
  dataSourceForRoutes: "entity_relationships (real observations only)";
};

export async function getAirlineIntelligence(iataCode: string): Promise<AirlineIntelligenceReport> {
  const [{ data: airline }, { data: edges }] = await Promise.all([
    supabaseAdmin.from("airlines").select("name, icao_code, country_code, alliance").eq("iata_code", iataCode).maybeSingle(),
    supabaseAdmin
      .from("entity_relationships")
      .select("object_id, metadata")
      .eq("subject_type", "airline")
      .eq("subject_id", iataCode)
      .eq("relationship_type", "observed_serving_route")
      .eq("object_type", "route"),
  ]);

  const observedRoutes = (edges ?? []).map((e) => {
    const meta = (e.metadata ?? {}) as { price?: number; currency?: string; observed_at?: string };
    return {
      route: e.object_id,
      lowestObservedPrice: meta.price ?? 0,
      currency: meta.currency ?? "USD",
      observedAt: meta.observed_at ?? "",
    };
  });

  return {
    iataCode,
    airline: airline
      ? { name: airline.name, icaoCode: airline.icao_code, countryCode: airline.country_code, alliance: airline.alliance }
      : null,
    dataSourceForIdentity: "airlines (static reference table)",
    observedRoutes,
    dataSourceForRoutes: "entity_relationships (real observations only)",
  };
}
