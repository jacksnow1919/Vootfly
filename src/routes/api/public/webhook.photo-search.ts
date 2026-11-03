import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/webhook/photo-search  body: { query: "London Big Ben", per_page?: 3-20 }
 * Searches Pixabay for destination photos (key stays on the server). Returns options
 * with their Pixabay page links so a person can check each one before saving.
 * GET returns the photos already saved for each destination.
 */
export const Route = createFileRoute("/api/public/webhook/photo-search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { photoSearchSchema, searchPhotos } = await import("@/lib/destination-photos.server");
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = photoSearchSchema.safeParse(json);
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        const result = await searchPhotos(parsed.data);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { listSavedPhotos } = await import("@/lib/destination-photos.server");
        return Response.json(await listSavedPhotos());
      },
    },
  },
});
