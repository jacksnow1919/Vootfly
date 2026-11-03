import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/daily-summary
 *
 * Scope narrowed 2026-09-26 on request: page updates and page indexing
 * only. Fare movements and fare-watch counts were removed from this
 * report (the detection code itself remains in fare-intelligence.server).
 *
 * "Page updates" is based on updated_at, NOT published_at. published_at
 * is not maintained when a page's content or fare snapshot changes, so
 * the previous version reported "no new pages" on days when pages had
 * genuinely been rewritten or refreshed.
 *
 * Query failures are returned rather than swallowed: a report that cannot
 * tell "nothing changed" from "the query broke" is worse than none.
 */
export const Route = createFileRoute("/api/public/webhook/daily-summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since24h = new Date(Date.now() - 86_400_000).toISOString();

        const { data, error } = await supabaseAdmin
          .from("seo_pages")
          .select(
            "path, from_code, to_code, status, qa_score, is_indexed, coverage_state, last_crawl_time, indexing_checked_at, created_at, updated_at, fare_snapshot_json",
          )
          .eq("status", "published")
          .limit(5000);

        if (error) {
          console.error("[daily-summary] pages query failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 200 });
        }

        const pages = data ?? [];
        const { getPlaces } = await import("@/lib/seo-pages.functions");
        const places = await getPlaces();
        const routeName = (f: string | null, t: string | null) =>
          `${f ? (places[f]?.name ?? f) : ""} to ${t ? (places[t]?.name ?? t) : ""}`;

        const coverage: Record<string, number> = {};
        for (const p of pages) {
          const k = p.coverage_state ?? "(never checked)";
          coverage[k] = (coverage[k] ?? 0) + 1;
        }

        const indexingRows = pages
          .map((p) => ({
            route: routeName(p.from_code, p.to_code),
            url: `https://www.vootfly.com${p.path}`,
            isIndexed: p.is_indexed,
            coverageState: p.coverage_state ?? "Not checked yet",
            lastCrawl: p.last_crawl_time,
            checkedAt: p.indexing_checked_at,
          }))
          // Not-indexed first: those are the ones needing attention.
          .sort((a, b) => Number(a.isIndexed === true) - Number(b.isIndexed === true) || a.route.localeCompare(b.route));

        const updated = pages
          .filter((p) => (p.updated_at ?? "") >= since24h)
          .map((p) => ({
            route: routeName(p.from_code, p.to_code),
            url: `https://www.vootfly.com${p.path}`,
            qaScore: p.qa_score,
            fare: (p.fare_snapshot_json as { lowest?: { amount?: number } } | null)?.lowest?.amount ?? null,
            updatedAt: p.updated_at,
            isNew: (p.created_at ?? "") >= since24h,
          }))
          .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

        return Response.json({
          ok: true,
          generatedAt: new Date().toISOString(),
          totalPublished: pages.length,
          indexing: {
            indexed: pages.filter((p) => p.is_indexed === true).length,
            notIndexed: pages.filter((p) => p.is_indexed === false).length,
            unknown: pages.filter((p) => p.is_indexed === null).length,
            coverage,
            rows: indexingRows,
          },
          updatedLast24h: updated,
          newLast24h: updated.filter((u) => u.isNew).length,
        });
      },
    },
  },
});
