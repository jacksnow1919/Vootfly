import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/booking-alerts-sent   body: { ids: [uuid, ...] }
 *
 * Marks booking requests as alerted. n8n calls this only AFTER the advisor
 * email has actually been sent, so a failed email leaves the request due
 * and it is retried on the next run instead of being silently lost.
 */
export const Route = createFileRoute("/api/public/webhook/booking-alerts-sent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let json: unknown = {};
        try { json = await request.json(); } catch { json = {}; }
        const parsed = z.object({ ids: z.array(z.string().uuid()).min(1).max(50), kind: z.enum(["advisor", "traveller"]).optional() }).safeParse(json ?? {});
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();
        const traveller = parsed.data.kind === "traveller";
        const column = traveller ? "traveller_notified_at" : "advisor_notified_at";
        const { error, count } = await supabaseAdmin
          .from("bookings")
          .update(traveller ? { traveller_notified_at: now } : { advisor_notified_at: now }, { count: "exact" })
          .in("id", parsed.data.ids)
          .is(column, null);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 200 });
        return Response.json({ ok: true, marked: count ?? 0 });
      },
    },
  },
});
