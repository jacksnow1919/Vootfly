import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/webhook/photo-save
 *   body: { place_code: "lon", pixabay_id: 123456, alt: "Big Ben and the Houses of Parliament in London" }
 *   Downloads the chosen Pixabay photo once and stores it in VootFly's own storage
 *   (bucket destination-photos). Route pages to that place, and its homepage card, then use it.
 *   body: { place_code: "lon", remove: true }  removes it (the built-in photo, if any, is used again).
 */
export const Route = createFileRoute("/api/public/webhook/photo-save")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { photoSaveSchema, savePhoto } = await import("@/lib/destination-photos.server");
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const parsed = photoSaveSchema.safeParse(json);
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        const result = await savePhoto(parsed.data);
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
