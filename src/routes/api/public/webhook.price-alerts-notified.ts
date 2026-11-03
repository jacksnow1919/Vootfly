import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/price-alerts-notified
 * body: { entries: [{ id, price }] }
 *
 * Records that an alert email was actually sent, and the price it quoted, so
 * the same drop is never emailed twice. Called only AFTER a successful send.
 */
export const Route = createFileRoute("/api/public/webhook/price-alerts-notified")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let json: unknown = {};
        try { json = await request.json(); } catch { json = {}; }
        const parsed = z.object({ entries: z.array(z.object({ id: z.string().uuid(), price: z.number().positive() })).min(1).max(500) }).safeParse(json ?? {});
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const at = new Date().toISOString();
        let updated = 0;
        for (const e of parsed.data.entries) {
          const { error } = await supabaseAdmin
            .from("price_alerts")
            .update({ last_seen_price: e.price, notified_at: at, last_checked_at: at })
            .eq("id", e.id);
          if (!error) updated += 1;
        }
        return Response.json({ ok: true, updated });
      },
    },
  },
});
