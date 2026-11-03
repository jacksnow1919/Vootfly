import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/record-metric   (phase tracker 1.3)
 * body: { metric, value?, passed?, detail? }
 * Stores one check result in metric_snapshots so the monthly scorecard can
 * show a trend instead of a single reading.
 */
export const Route = createFileRoute("/api/public/webhook/record-metric")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let json: unknown = {};
        try { json = await request.json(); } catch { json = {}; }
        const parsed = z
          .object({
            metric: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
            value: z.number().finite().nullable().optional(),
            passed: z.boolean().nullable().optional(),
            detail: z.record(z.string(), z.unknown()).nullable().optional(),
          })
          .safeParse(json ?? {});
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("metric_snapshots").insert({
          metric: parsed.data.metric,
          value: parsed.data.value ?? null,
          passed: parsed.data.passed ?? null,
          detail: (parsed.data.detail ?? null) as never,
        });
        if (error) return Response.json({ ok: false, error: error.message });
        return Response.json({ ok: true });
      },
    },
  },
});
