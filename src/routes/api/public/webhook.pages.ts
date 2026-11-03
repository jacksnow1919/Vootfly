import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * n8n <-> site contract (v2). All calls need header x-webhook-secret: $N8N_WEBHOOK_SECRET.
 *
 * POST /api/public/webhook/pages   body: PageUpsert | PageUpsert[]  -> upsert pages, index gate decides status
 * GET  /api/public/webhook/pages?queue=fare-refresh|index-check|candidates|content|published-24h&limit=50 -> work queue for n8n
 */
export const Route = createFileRoute("/api/public/webhook/pages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized, pageUpsertSchema, upsertPages } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = z.union([pageUpsertSchema, z.array(pageUpsertSchema).min(1).max(100)]).safeParse(json);
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        const results = await upsertPages(Array.isArray(parsed.data) ? parsed.data : [parsed.data]);
        const failed = results.filter((r) => !r.ok);
        return Response.json({ ok: failed.length === 0, count: results.length - failed.length, results }, { status: failed.length ? 207 : 200 });
      },
      GET: async ({ request }) => {
        const { authorized, workQueue } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const url = new URL(request.url);
        const queue = url.searchParams.get("queue");
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
        const queues = ["fare-refresh", "index-check", "candidates", "content", "published-24h"] as const;
        if (!queue || !(queues as readonly string[]).includes(queue)) {
          return Response.json({ error: `queue must be one of ${queues.join(", ")}` }, { status: 400 });
        }
        if (queue === "candidates") {
          const { rankedCandidates } = await import("@/lib/seo-pages.server");
          const ranked = await rankedCandidates(limit);
          return Response.json({ ok: true, queue, count: ranked.length, scoring: ranked[0]?.scoring ?? "none", items: ranked });
        }
        const items = await workQueue(queue as (typeof queues)[number], limit);
        return Response.json({ ok: true, queue, count: items.length, items });
      },
    },
  },
});
