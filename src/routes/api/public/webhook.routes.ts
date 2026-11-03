// DEPRECATED (v1): kept for backward compatibility with the old seo_route_pages table.
// New pipelines must use /api/public/webhook/pages (see src/lib/seo-pages.server.ts).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers and hyphens"),
  origin: z.string().min(1).max(120),
  destination: z.string().min(1).max(120),
  meta_title: z.string().min(1).max(200),
  meta_description: z.string().max(400).optional(),
  content_json: z.record(z.string(), z.unknown()).optional(),
});

const bodySchema = z.union([payloadSchema, z.array(payloadSchema).min(1).max(200)]);

export const Route = createFileRoute("/api/public/webhook/routes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["N8N_WEBHOOK_SECRET"];
        const provided = request.headers.get("x-webhook-secret") ?? "";
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid payload", issues: parsed.error.issues },
            { status: 400 },
          );
        }

        const rows = (Array.isArray(parsed.data) ? parsed.data : [parsed.data]).map((r) => ({
          slug: r.slug,
          origin: r.origin,
          destination: r.destination,
          meta_title: r.meta_title,
          meta_description: r.meta_description ?? null,
          content_json: (r.content_json ?? {}) as never,
        }));

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("seo_route_pages")
          .upsert(rows, { onConflict: "slug" })
          .select("slug");

        if (error) {
          console.error("[webhook/routes] upsert failed", error.message);
          return Response.json({ error: "Failed to save route pages" }, { status: 500 });
        }

        return Response.json({
          ok: true,
          count: data?.length ?? 0,
          slugs: data?.map((d) => d.slug),
        });
      },
    },
  },
});
