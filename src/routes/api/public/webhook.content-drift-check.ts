import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/content-drift-check
 *
 * Finds published route pages where the REAL price quoted in the body copy
 * (content_json.intro, written once by W1) has drifted materially from the
 * REAL current fare (fare_snapshot_json.lowest.amount, refreshed by W6 on
 * its own tiered cadence: 12h to 7 days, independent of content).
 *
 * This is the structural version of the bug found and fixed manually
 * across 9 pages this session: W6 keeps the card honest, nothing keeps the
 * body honest, so the two silently diverge over time. Detecting it here
 * closes the loop instead of requiring another one-off manual sweep.
 *
 * Deliberately conservative -- a >=15% divergence, not any divergence at
 * all -- so normal day-to-day fare movement (confirmed as real and
 * expected in Phase 6, where an 8%/$25 move already counts as a genuine
 * change) does not trigger a Gemini regeneration on every refresh. This
 * only fires when the body is genuinely wrong, not merely a day old.
 */
export const Route = createFileRoute("/api/public/webhook/content-drift-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("seo_pages")
          .select("path, from_code, to_code, cabin, content_json, fare_snapshot_json")
          .eq("page_type", "route")
          .eq("status", "published")
          .limit(5000);

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const DRIFT_THRESHOLD = 0.15;
        const drifted = [];

        for (const p of data ?? []) {
          const intro = (p.content_json as { intro?: string } | null)?.intro ?? "";
          const realNow = (p.fare_snapshot_json as { lowest?: { amount?: number } } | null)?.lowest?.amount;
          if (!realNow) continue; // no real current fare to compare against

          // First dollar figure in the intro is the one a reader (and Google)
          // actually sees first -- that is the one that matters most.
          const match = intro.match(/\$([\d,]+)/);
          if (!match) continue; // intro states no price at all -- nothing to drift
          const bodyPrice = Number(match[1]!.replace(/,/g, ""));
          if (!bodyPrice) continue;

          const drift = Math.abs(bodyPrice - realNow) / realNow;
          if (drift < DRIFT_THRESHOLD) continue;

          drifted.push({
            path: p.path,
            from_code: p.from_code,
            to_code: p.to_code,
            cabin: p.cabin,
            bodyPrice,
            realPrice: realNow,
            driftPercent: Math.round(drift * 1000) / 10,
          });
        }

        return Response.json({ ok: true, checked: (data ?? []).length, driftedCount: drifted.length, drifted });
      },
    },
  },
});
