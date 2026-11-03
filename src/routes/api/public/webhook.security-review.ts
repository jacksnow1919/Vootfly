import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/security-review?days=7   (phase tracker 1.2, agent 46)
 *
 * Weekly security review data: accounts created and signed in, who holds a
 * role, staff console accounts (new ones flagged), staff actions on bookings,
 * and sign-in events from the auth log. Gathered by the database function
 * security_review_summary, which only the server (service role) may run.
 */
export const Route = createFileRoute("/api/public/webhook/security-review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 7));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("security_review_summary", { window_days: days });
        if (error) return Response.json({ ok: false, error: error.message });
        return Response.json({ ok: true, ...(data as Record<string, unknown>) });
      },
    },
  },
});
