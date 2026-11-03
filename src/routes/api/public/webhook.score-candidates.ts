import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/score-candidates  body: { limit?: 1-50, cabin?: business|first }
 * W2 keyword-research step: pulls REAL Google Ads Keyword Planner metrics for unscored gateway x destination
 * candidates and stores search volume, competition index and opportunity score. One provider call per candidate.
 */
export const Route = createFileRoute("/api/public/webhook/score-candidates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized, scoreCandidates } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let json: unknown = {};
        try {
          json = await request.json();
        } catch {
          json = {};
        }
        const parsed = z.object({ limit: z.number().int().min(1).max(50).default(15), cabin: z.enum(["economy", "business", "first"]).default("economy") }).safeParse(json ?? {});
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        const result = await scoreCandidates(parsed.data.limit, parsed.data.cabin);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
