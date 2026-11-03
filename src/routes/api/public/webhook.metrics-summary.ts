import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/metrics-summary   (phase tracker 1.4)
 * For the monthly scorecard: the latest reading of every stored metric with
 * the reading from about 30 days earlier (for the trend), plus live counts
 * from the database. Query failures return ok:false, never zeros.
 */
export const Route = createFileRoute("/api/public/webhook/metrics-summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since120 = new Date(Date.now() - 120 * 86_400_000).toISOString();
        const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
        const [snaps, pages, bookings, alerts] = await Promise.all([
          supabaseAdmin.from("metric_snapshots").select("metric, value, passed, detail, recorded_at").gte("recorded_at", since120).order("recorded_at", { ascending: false }).limit(5000),
          supabaseAdmin.from("seo_pages").select("qa_score, is_indexed").eq("status", "published").limit(5000),
          supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", since30).neq("source", "test"),
          supabaseAdmin.from("price_alerts").select("id", { count: "exact", head: true }).eq("is_active", true),
        ]);
        const err = snaps.error ?? pages.error ?? bookings.error ?? alerts.error;
        if (err) return Response.json({ ok: false, error: err.message });

        type Row = { metric: string; value: number | null; passed: boolean | null; detail: unknown; recorded_at: string };
        const byMetric: Record<string, { latest: Row; previous: Row | null; readings: number }> = {};
        for (const r of (snaps.data ?? []) as Row[]) {
          const m = byMetric[r.metric];
          if (!m) byMetric[r.metric] = { latest: r, previous: null, readings: 1 };
          else {
            m.readings++;
            // "previous" = most recent reading at least ~30 days older than the latest (or the oldest available).
            const gap = Date.parse(m.latest.recorded_at) - Date.parse(r.recorded_at);
            if (!m.previous || gap < 27 * 86_400_000) m.previous = r;
          }
        }
        const p = pages.data ?? [];
        const qa = p.filter((x) => typeof x.qa_score === "number").map((x) => x.qa_score as number);
        return Response.json({
          ok: true,
          generatedAt: new Date().toISOString(),
          metrics: byMetric,
          live: {
            publishedPages: p.length,
            indexedPages: p.filter((x) => x.is_indexed === true).length,
            avgPageQa: qa.length ? Math.round((qa.reduce((a, b) => a + b, 0) / qa.length) * 10) / 10 : null,
            bookingRequests30d: bookings.count ?? 0,
            activeFareWatches: alerts.count ?? 0,
          },
        });
      },
    },
  },
});
