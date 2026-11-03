/**
 * Destination Intelligence — Phase 3 Foundation.
 *
 * Scoped deliberately to what real data actually supports: place identity
 * (from the existing places hierarchy) and real route/fare associations.
 * Per explicit instruction, Visa/Activity/Weather Intelligence are NOT
 * built here -- those fields stay undefined (matching DestinationContract
 * from Phase 1), never filled with a guess. This is not a smaller version
 * of a "destination guide" -- it deliberately omits what would require
 * data VootFly does not have.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DestinationIntelligenceReport = {
  code: string;
  place: { name: string; level: string; parentCode: string | null } | null;
  dataSourceForPlace: "places (existing hierarchy, unmodified)";
  /** Real origins with an observed fare to this destination. */
  reachableFrom: { fromCode: string; lowestObservedPrice: number; currency: string; observedAt: string }[];
  dataSourceForFares: "fare_observations (real data only)";
  /** Deliberately absent, not a guessed/default value -- no real visa,
   * weather, or activity data source exists yet (see travel-contracts.ts's
   * DestinationContract, Phase 1, and the Phase 3 instruction not to build
   * these yet). */
  visaInfo: undefined;
  weatherSummary: undefined;
};

export async function getDestinationIntelligence(code: string): Promise<DestinationIntelligenceReport> {
  const [{ data: place }, { data: observations }] = await Promise.all([
    supabaseAdmin.from("places").select("name, level, parent_code").eq("code", code).maybeSingle(),
    supabaseAdmin
      .from("fare_observations")
      .select("from_code, price, currency, observed_at")
      .eq("to_code", code)
      .order("price", { ascending: true }),
  ]);

  return {
    code,
    place: place ? { name: place.name, level: place.level, parentCode: place.parent_code } : null,
    dataSourceForPlace: "places (existing hierarchy, unmodified)",
    reachableFrom: (observations ?? []).map((o) => ({
      fromCode: o.from_code,
      lowestObservedPrice: o.price,
      currency: o.currency,
      observedAt: o.observed_at,
    })),
    dataSourceForFares: "fare_observations (real data only)",
    visaInfo: undefined,
    weatherSummary: undefined,
  };
}
