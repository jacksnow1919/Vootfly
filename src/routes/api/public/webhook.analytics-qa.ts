import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/analytics-qa?days=7   (phase tracker 1.1, agent 48)
 *
 * The database side of the weekly Analytics QA: what really happened, for n8n
 * to compare against Mixpanel and GA4. Two reconcilable pairs:
 *   booking requests (bookings)   vs  "Booking Requested"  / booking_requested
 *   fare watches (price_alerts)   vs  "Fare Watch Created" / fare_watch_created
 * Test bookings (source = 'test') are excluded so a test can never inflate the
 * real count. A query failure returns ok:false, never a zero.
 */
export const Route = createFileRoute("/api/public/webhook/analytics-qa")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 7));
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [b, a] = await Promise.all([
          supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", since).neq("source", "test"),
          supabaseAdmin.from("price_alerts").select("id", { count: "exact", head: true }).gte("created_at", since),
        ]);
        if (b.error || a.error) return Response.json({ ok: false, error: (b.error ?? a.error)!.message });
        // Phase 5.1: booking stages for the funnel's later steps.
        const st = await supabaseAdmin.from("bookings").select("status").gte("created_at", since).neq("source", "test").limit(5000);
        if (st.error) return Response.json({ ok: false, error: st.error.message });
        const bookingsByStatus: Record<string, number> = {};
        for (const r of st.data ?? []) bookingsByStatus[r.status] = (bookingsByStatus[r.status] ?? 0) + 1;
        return Response.json({ ok: true, windowDays: days, since, bookingRequests: b.count ?? 0, fareWatches: a.count ?? 0, bookingsByStatus });
      },
    },
  },
});
