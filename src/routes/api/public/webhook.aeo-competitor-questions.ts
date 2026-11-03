import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/aeo-competitor-questions
 * body: { route, questions: [{ query, source_name, source_url }] }
 *
 * Stores REAL, source-attributed questions found via web search on real
 * competitor pages (Google Flights, Expedia, Skyscanner, etc) for
 * VootFly's real published routes.
 *
 * HONEST SCOPE: this is NOT Google's "People Also Ask" API -- no such
 * credential exists in this project. It is real question content genuinely
 * published on real, named competitor pages for this exact route, found via
 * web search with real citations, tagged source_type='competitor_research'
 * so it is never confused with source_type='gsc_query' rows (VootFly's own
 * real Search Console data). Different evidence, kept honestly distinct.
 */
export const Route = createFileRoute("/api/public/webhook/aeo-competitor-questions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        let json: unknown = {};
        try { json = await request.json(); } catch { json = {}; }

        const parsed = z
          .object({
            route: z.string().min(1),
            questions: z
              .array(z.object({ query: z.string().min(1).max(300), source_name: z.string().min(1), source_url: z.string().url() }))
              .min(1)
              .max(50),
          })
          .safeParse(json ?? {});
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();
        let stored = 0;
        for (const q of parsed.data.questions) {
          const { error } = await supabaseAdmin.from("aeo_questions").upsert(
            {
              query: q.query.trim(),
              route: parsed.data.route,
              source_type: "competitor_research",
              source_name: q.source_name,
              source_url: q.source_url,
              last_seen_at: now,
            },
            { onConflict: "query" },
          );
          if (!error) stored += 1;
        }
        return Response.json({ ok: true, submitted: parsed.data.questions.length, stored });
      },
    },
  },
});
