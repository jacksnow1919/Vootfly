/**
 * Route Intelligence — Phase 3 Foundation.
 *
 * Combines real data already available across three existing, unmodified
 * sources: the `routes` catalog (Phase 1), the `places` hierarchy
 * (untouched, pre-existing), and real fare data (fare_observations,
 * Phase 3; seo_pages, read-only). No live query to PKFARE is made here --
 * this reports on data already captured, not a new live search.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFareIntelligence, type FareIntelligenceReport } from "@/lib/fare-intelligence.server";

export type RouteIntelligenceReport = {
  fromCode: string;
  toCode: string;
  /** True only if a row exists in the `routes` catalog table. */
  inCatalog: boolean;
  fromPlace: { code: string; name: string; level: string } | null;
  toPlace: { code: string; name: string; level: string } | null;
  /** True only if a real, published seo_pages route page exists for this pair. */
  hasSeoPage: boolean;
  seoPagePath: string | null;
  fare: FareIntelligenceReport;
};

export async function getRouteIntelligence(fromCode: string, toCode: string, cabin = "economy"): Promise<RouteIntelligenceReport> {
  const [{ data: routeRow }, { data: places }, { data: seoPage }, fare] = await Promise.all([
    supabaseAdmin.from("routes").select("id").eq("from_code", fromCode).eq("to_code", toCode).maybeSingle(),
    supabaseAdmin.from("places").select("code, name, level").in("code", [fromCode, toCode]),
    supabaseAdmin
      .from("seo_pages")
      .select("path")
      .eq("page_type", "route")
      .eq("from_code", fromCode)
      .eq("to_code", toCode)
      .eq("status", "published")
      .maybeSingle(),
    getFareIntelligence(fromCode, toCode, cabin),
  ]);

  const fromPlace = places?.find((p) => p.code === fromCode) ?? null;
  const toPlace = places?.find((p) => p.code === toCode) ?? null;

  return {
    fromCode,
    toCode,
    inCatalog: !!routeRow,
    fromPlace,
    toPlace,
    hasSeoPage: !!seoPage,
    seoPagePath: seoPage?.path ?? null,
    fare,
  };
}
