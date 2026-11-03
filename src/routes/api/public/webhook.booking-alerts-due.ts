import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/booking-alerts-due
 *
 * P0 (phase tracker, 26 Sep 2026): booking requests were saved correctly,
 * with the live fare re-checked first, but nothing told anyone they had
 * arrived, while the confirmation page promises the traveller that a team
 * member will make contact. This lists every booking request whose advisor
 * has not yet been alerted, so n8n can email it within minutes.
 *
 * Only what an advisor needs for first contact is returned: reference,
 * route, dates, price (and the re-checked price), and the lead traveller's
 * name, email and phone, plus passenger names. Passport numbers and dates
 * of birth are deliberately NOT included; they stay in the database.
 *
 * Only requests from the last 14 days are returned, so a backlog of stale
 * rows could never flood the inbox if alerting were ever paused.
 */
export const Route = createFileRoute("/api/public/webhook/booking-alerts-due")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // kind=advisor (default): alert the advisor inbox (P0).
        // kind=traveller (phase tracker 4.2): confirmation email to the traveller.
        // Test bookings and requests without an email address never get a
        // traveller email, so a test can never write to a real customer.
        const kind = new URL(request.url).searchParams.get("kind") === "traveller" ? "traveller" : "advisor";
        const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
        let q = supabaseAdmin
          .from("bookings")
          .select(
            "id, pnr, created_at, origin, destination, airline, cabin_class, depart_date, return_date, total_price, currency, revalidation_status, revalidated_price, lead_name, guest_email, guest_phone, source, status",
          )
          .is(kind === "traveller" ? "traveller_notified_at" : "advisor_notified_at", null)
          .gte("created_at", since);
        if (kind === "traveller") q = q.neq("source", "test").not("guest_email", "is", null);
        const { data, error } = await q.order("created_at", { ascending: true }).limit(50);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 200 });

        const ids = (data ?? []).map((b) => b.id);
        const names: Record<string, string[]> = {};
        if (ids.length) {
          const { data: pax } = await supabaseAdmin
            .from("passengers")
            .select("booking_id, title, first_name, last_name")
            .in("booking_id", ids);
          for (const p of pax ?? []) {
            (names[p.booking_id] ||= []).push([p.title, p.first_name, p.last_name].filter(Boolean).join(" "));
          }
        }

        return Response.json({
          ok: true,
          kind,
          due: (data ?? []).map((b) => ({ ...b, passengers: names[b.id] ?? [] })),
        });
      },
    },
  },
});
