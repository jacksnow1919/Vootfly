import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** POST /api/public/webhook/fares  body: FareUpdate | FareUpdate[] (real PKfare snapshots only). */
export const Route = createFileRoute("/api/public/webhook/fares")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized, fareUpdateSchema, applyFareSnapshot } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = z.union([fareUpdateSchema, z.array(fareUpdateSchema).min(1).max(100)]).safeParse(json);
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
        const results = [];
        for (const i of items) results.push(await applyFareSnapshot(i));
        const failed = results.filter((r) => !r.ok);
        return Response.json({ ok: failed.length === 0, results }, { status: failed.length ? 207 : 200 });
      },
    },
  },
});
