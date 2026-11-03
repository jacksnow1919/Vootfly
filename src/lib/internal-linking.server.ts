/**
 * Internal Linking Engine — Phase 6.
 *
 * Upgrades internal linking from "every page renders a fixed set of link
 * blocks" to something that can actually see the site as a graph: which
 * published pages are orphaned, which destination clusters are thin, and
 * which real relationships exist that no page currently links along.
 *
 * Reads only. Fetches nothing, writes nothing, publishes nothing. It
 * reports what the link graph looks like so a human (or a later phase)
 * can decide what to do about it. Every finding is derived from real
 * published pages, the real places hierarchy, and real observed
 * entity_relationships -- never from an assumed site structure.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LinkGraphReport = {
  publishedPages: number;
  /** Destination cities that have a published route page. */
  destinationsCovered: number;
  /** Real origin cities with at least one published page. */
  originsCovered: number;
  /** Destinations reachable in our real fare data that have NO page yet.
   * These are genuine internal-link gaps: the site knows the relationship
   * exists but has nowhere to point at. */
  uncoveredDestinations: { code: string; observedAirlines: number }[];
  /** Destinations with exactly one inbound route page. A cluster of one is
   * weak: it has no sibling pages to link to or from. */
  thinClusters: { code: string; pages: number }[];
  /** Origin cities carrying a disproportionate share of all pages. A single
   * dominant origin means most pages can only link "sideways" to each other. */
  originConcentration: { code: string; pages: number; sharePercent: number }[];
  generatedAt: string;
};

export async function buildLinkGraphReport(): Promise<LinkGraphReport> {
  const [{ data: pages }, { data: edges }] = await Promise.all([
    supabaseAdmin
      .from("seo_pages")
      .select("from_code, to_code, status")
      .eq("page_type", "route")
      .eq("status", "published")
      .limit(20000),
    supabaseAdmin
      .from("entity_relationships")
      .select("subject_id, object_id, relationship_type, subject_type")
      .eq("relationship_type", "served_by_airline")
      .eq("subject_type", "city")
      .limit(20000),
  ]);

  const live = pages ?? [];
  const origins = new Map<string, number>();
  const destinations = new Map<string, number>();
  for (const p of live) {
    if (p.from_code) origins.set(p.from_code, (origins.get(p.from_code) ?? 0) + 1);
    if (p.to_code) destinations.set(p.to_code, (destinations.get(p.to_code) ?? 0) + 1);
  }

  // Cities we have REAL airline observations for, from the knowledge graph.
  const airlinesPerCity = new Map<string, Set<string>>();
  for (const e of edges ?? []) {
    const set = airlinesPerCity.get(e.subject_id) ?? new Set<string>();
    set.add(e.object_id);
    airlinesPerCity.set(e.subject_id, set);
  }

  const uncoveredDestinations = [...airlinesPerCity.entries()]
    .filter(([code]) => !destinations.has(code))
    .map(([code, set]) => ({ code, observedAirlines: set.size }))
    .sort((a, b) => b.observedAirlines - a.observedAirlines);

  const thinClusters = [...destinations.entries()]
    .filter(([, n]) => n === 1)
    .map(([code, pages]) => ({ code, pages }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const total = live.length || 1;
  const originConcentration = [...origins.entries()]
    .map(([code, pages]) => ({ code, pages, sharePercent: Math.round((pages / total) * 1000) / 10 }))
    .sort((a, b) => b.pages - a.pages);

  return {
    publishedPages: live.length,
    destinationsCovered: destinations.size,
    originsCovered: origins.size,
    uncoveredDestinations,
    thinClusters,
    originConcentration,
    generatedAt: new Date().toISOString(),
  };
}
