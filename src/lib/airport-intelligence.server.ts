/**
 * Airport Intelligence — Phase 3 Foundation.
 *
 * Reads the existing, unmodified `places` hierarchy (airport/metro level)
 * plus the real `routes` catalog and real fare_observations touching this
 * airport's metro code. Does not alter places in any way -- read-only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AirportIntelligenceReport = {
  code: string;
  /** Null if this code doesn't exist in places at all. */
  place: { name: string; level: string; parentCode: string | null; iata: string | null } | null;
  dataSourceForPlace: "places (existing hierarchy, unmodified)";
  /** Real routes.from_code/to_code pairs touching this code. */
  routesFrom: string[];
  routesTo: string[];
  /** Real distinct airlines observed on any route touching this code,
   * from fare_observations -- never a claimed full network. */
  observedAirlines: string[];
  dataSourceForRoutesAndAirlines: "routes + fare_observations (real data only)";
};

export async function getAirportIntelligence(code: string): Promise<AirportIntelligenceReport> {
  const [{ data: place }, { data: routesFrom }, { data: routesTo }, { data: observations }] = await Promise.all([
    supabaseAdmin.from("places").select("name, level, parent_code, iata").eq("code", code).maybeSingle(),
    supabaseAdmin.from("routes").select("to_code").eq("from_code", code),
    supabaseAdmin.from("routes").select("from_code").eq("to_code", code),
    supabaseAdmin
      .from("fare_observations")
      .select("airline_iata")
      .or(`from_code.eq.${code},to_code.eq.${code}`),
  ]);

  const observedAirlines = [
    ...new Set((observations ?? []).map((o) => o.airline_iata).filter((a): a is string => !!a)),
  ];

  return {
    code,
    place: place ? { name: place.name, level: place.level, parentCode: place.parent_code, iata: place.iata } : null,
    dataSourceForPlace: "places (existing hierarchy, unmodified)",
    routesFrom: (routesFrom ?? []).map((r) => r.to_code),
    routesTo: (routesTo ?? []).map((r) => r.from_code),
    observedAirlines,
    dataSourceForRoutesAndAirlines: "routes + fare_observations (real data only)",
  };
}
