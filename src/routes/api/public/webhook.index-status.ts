import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** POST /api/public/webhook/index-status  body: {path, indexed_status, checked_at?} | [] (from Google URL Inspection API). */
export const Route = createFileRoute("/api/public/webhook/index-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized, indexStatusSchema, applyIndexStatus } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = z.union([indexStatusSchema, z.array(indexStatusSchema).min(1).max(200)]).safeParse(json);
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        const results = await applyIndexStatus(Array.isArray(parsed.data) ? parsed.data : [parsed.data]);
        return Response.json({ ok: results.every((r) => r.ok), results });
      },
    },
  },
});
