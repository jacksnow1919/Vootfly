import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/webhook/fare-lookup
 * body: { from_code, to_code, cabin?, depart_date?, return_date?, months?, apply? }
 * Runs a real PKfare search on the site (keys never leave the server) and returns a FareSnapshot.
 * With apply=true the snapshot is written to the matching seo_pages row and the index gate re-runs.
 * Each call is 1 provider request (+1 per month probe, +up to 3 airport fallbacks). Not cached.
 */
export const Route = createFileRoute("/api/public/webhook/fare-lookup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized, fareLookupSchema, lookupFareSnapshot } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = fareLookupSchema.safeParse(json);
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        const result = await lookupFareSnapshot(parsed.data);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
