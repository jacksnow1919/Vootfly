import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/refresh-performance
 * body: { periodDays: number, rows: [{ path, impressions, clicks, ctr, position }] }
 *
 * Writes REAL Search Console performance per page.
 *
 * Search Console returns rows only for pages that actually had impressions
 * in the period. A published page missing from the response therefore has
 * genuinely zero impressions, which is a real fact and is written as 0 --
 * but only for pages the caller confirms were included in the query window.
 * performance_checked_at is stamped either way, so "checked, had none" is
 * distinguishable from "never checked", which a bare 0 could not express.
 */
export const Route = createFileRoute("/api/public/webhook/refresh-performance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        let json: unknown = {};
        try {
          json = await request.json();
        } catch {
          json = {};
        }

        const parsed = z
          .object({
            periodDays: z.number().int().min(1).max(480).default(28),
            rows: z
              .array(
                z.object({
                  path: z.string().min(1),
                  impressions: z.number().int().min(0),
                  clicks: z.number().int().min(0),
                  ctr: z.number().min(0).max(1),
                  position: z.number().min(0),
                }),
              )
              .max(5000),
            /** When true, published pages absent from rows are recorded as a
             * real zero for this period rather than left untouched. */
            zeroFillPublished: z.boolean().default(true),
          })
          .safeParse(json ?? {});

        if (!parsed.success) {
          return Response.json({ ok: false, error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const checkedAt = new Date().toISOString();
        const { periodDays, rows, zeroFillPublished } = parsed.data;

        let updated = 0;
        const seen = new Set<string>();
        // SERP position history (Phase 8). The seo_pages snapshot columns
        // below are overwritten on every run by design -- useful for "right
        // now" but unable to show movement over time. history_rows appends
        // one real row per page per run instead, so position/impression
        // trends become queryable. Same real GSC data, no separate fetch.
        const historyRows: { path: string; impressions: number; clicks: number; ctr: number; position: number; period_days: number; checked_at: string }[] = [];

        for (const r of rows) {
          seen.add(r.path);
          historyRows.push({ path: r.path, impressions: r.impressions, clicks: r.clicks, ctr: r.ctr, position: r.position, period_days: periodDays, checked_at: checkedAt });
          // FIXED: Supabase's .update() returns no error when zero rows
          // match the filter, so counting on (!error) reported "updated"
          // even for paths with no seo_pages row at all -- confirmed live:
          // GSC's real /terms-conditions, /refund-policy etc rows (static
          // pages, not seo_pages route entries) were counted as updated
          // when zero rows actually changed. count:"exact" reports the
          // real number of rows the update touched.
          const { error, count } = await supabaseAdmin
            .from("seo_pages")
            .update({
              gsc_impressions: r.impressions,
              gsc_clicks: r.clicks,
              gsc_ctr: r.ctr,
              gsc_position: r.position,
              gsc_period_days: periodDays,
              performance_checked_at: checkedAt,
            }, { count: "exact" })
            .eq("path", r.path);
          if (!error) updated += count ?? 0;
        }

        let zeroed = 0;
        if (zeroFillPublished) {
          const { data: published } = await supabaseAdmin
            .from("seo_pages")
            .select("path")
            .eq("status", "published")
            .limit(5000);
          for (const p of published ?? []) {
            if (seen.has(p.path)) continue;
            const { error } = await supabaseAdmin
              .from("seo_pages")
              .update({
                gsc_impressions: 0,
                gsc_clicks: 0,
                gsc_ctr: 0,
                gsc_position: null, // no position exists when there were no impressions
                gsc_period_days: periodDays,
                performance_checked_at: checkedAt,
              })
              .eq("path", p.path);
            if (!error) zeroed += 1;
          }
        }

        // Write history for pages that genuinely had a row (real impressions).
        // Zero-filled pages are NOT written to history: a page with no
        // impressions has no real position to record, and writing position 0
        // there would fabricate a ranking that does not exist.
        let historyWritten = 0;
        if (historyRows.length) {
          const { error: histError, count } = await supabaseAdmin
            .from("gsc_position_history")
            .insert(historyRows, { count: "exact" });
          if (histError) console.error("[refresh-performance] history insert failed", histError);
          else historyWritten = count ?? historyRows.length;
        }

        return Response.json({ ok: true, updated, zeroed, historyWritten, periodDays });
      },
    },
  },
});
