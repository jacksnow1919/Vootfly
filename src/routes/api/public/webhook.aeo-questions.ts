import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/aeo-questions
 * body: { queries: [{ query, impressions, clicks, position }] }
 *
 * Stores REAL question-shaped search queries from Search Console's query
 * dimension (not page dimension), for future AEO content targeting.
 *
 * HONEST SCOPE NOTE: "People Also Ask" data requires a paid SERP-scraping
 * API (SerpAPI, DataForSEO, or similar). No such credential exists in this
 * project -- only Google Ads Keyword Planner and Search Console are wired.
 * Fabricating PAA-shaped questions would not be real data, so this endpoint
 * covers only the genuinely available real source: queries that already
 * produced real impressions on VootFly, filtered to question-shaped ones.
 *
 * Filtering happens here (not just in the caller) so a bad payload can
 * never smuggle in a non-question row.
 */
const QUESTION_RE = /^(how|what|when|where|why|which|who|can|does|is|are|should|will)\b/i;

export const Route = createFileRoute("/api/public/webhook/aeo-questions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        let json: unknown = {};
        try { json = await request.json(); } catch { json = {}; }

        const parsed = z
          .object({
            queries: z
              .array(z.object({ query: z.string().min(1), impressions: z.number().int().min(0), clicks: z.number().int().min(0), position: z.number().min(0) }))
              .max(2000),
          })
          .safeParse(json ?? {});
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });

        const questions = parsed.data.queries.filter((q) => QUESTION_RE.test(q.query.trim()));

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();
        let stored = 0;
        for (const q of questions) {
          const { error } = await supabaseAdmin
            .from("aeo_questions")
            .upsert(
              {
                query: q.query.trim(),
                impressions: q.impressions,
                clicks: q.clicks,
                ctr: q.impressions > 0 ? q.clicks / q.impressions : 0,
                position: q.position,
                period_days: 28,
                last_seen_at: now,
              },
              { onConflict: "query" },
            );
          if (!error) stored += 1;
        }

        return Response.json({ ok: true, totalQueries: parsed.data.queries.length, questionShaped: questions.length, stored });
      },
    },
  },
});
