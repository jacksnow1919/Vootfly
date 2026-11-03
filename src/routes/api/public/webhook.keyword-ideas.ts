import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/keyword-ideas
 * body: { seeds: string[] (1-20), page_size?: 10-1000, must_contain_all?: string[] }
 *
 * Read-only per-page keyword research. Calls Google Ads Keyword Planner
 * (generateKeywordIdeas, US, English, Google Search) with the seeds you
 * choose and returns every idea with its real metrics. Nothing is written
 * to the database, so it can be run freely while drafting a page.
 *
 * score-candidates stays the ranking step (fixed seeds, top 12 stored per
 * route). This endpoint is for the deeper research done before writing:
 * question phrasings, airport-code variants, flight-time and non-stop
 * intent, which the fixed seeds and the 12-keyword cap leave out.
 *
 * must_contain_all: optional lowercase tokens; an idea is kept only if it
 * contains at least one variant from EACH group, e.g.
 * [["boston","bos"],["paris","cdg"]] keeps only on-route ideas.
 */
export const Route = createFileRoute("/api/public/webhook/keyword-ideas")({
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
            seeds: z.array(z.string().min(2).max(80)).min(1).max(20),
            page_size: z.number().int().min(10).max(1000).default(300),
            must_contain_all: z.array(z.array(z.string().min(2).max(40)).min(1)).max(4).optional(),
          })
          .safeParse(json ?? {});
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });

        const { googleAdsConfigured, keywordIdeas } = await import("@/lib/google-ads.server");
        if (!googleAdsConfigured()) return Response.json({ ok: false, error: "Google Ads secrets not configured (GOOGLE_ADS_*)." }, { status: 400 });

        try {
          const ideas = await keywordIdeas(parsed.data.seeds, parsed.data.page_size);
          const groups = (parsed.data.must_contain_all ?? []).map((g) => g.map((t) => t.toLowerCase()));
          const kept = ideas
            .filter((k) => groups.every((g) => g.some((t) => k.keyword.toLowerCase().includes(t))))
            .sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches);
          return Response.json({ ok: true, source: "google-ads-keyword-planner", geo: "US", language: "en", seeds: parsed.data.seeds, total_ideas: ideas.length, kept: kept.length, ideas: kept });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message.slice(0, 400) }, { status: 502 });
        }
      },
    },
  },
});
