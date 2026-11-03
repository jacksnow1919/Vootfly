import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/drift-regen-payload
 * body: { from_code, to_code, cabin }
 *
 * Returns the real, current data W1 needs to regenerate a drifted page's
 * body copy -- WITHOUT re-fetching a fare from PKFARE, since a drifted
 * page's card is already correct (drift means the card refreshed and the
 * body did not catch up, not that the fare itself is stale). Reuses the
 * real, already-stored fare_snapshot_json plus real place names and real
 * Keyword Planner keywords from route_candidates, so W1 regenerates from
 * the exact same current real data the drift check compared against.
 */
export const Route = createFileRoute("/api/public/webhook/drift-regen-payload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        let json: unknown = {};
        try { json = await request.json(); } catch { json = {}; }
        const parsed = z.object({ from_code: z.string().min(1), to_code: z.string().min(1), cabin: z.string().min(1) }).safeParse(json ?? {});
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getPlaces } = await import("@/lib/seo-pages.functions");
        const { from_code, to_code, cabin } = parsed.data;

        const [{ data: page }, places, { data: candidate }] = await Promise.all([
          supabaseAdmin.from("seo_pages").select("fare_snapshot_json").eq("from_code", from_code).eq("to_code", to_code).eq("cabin", cabin).maybeSingle(),
          getPlaces(),
          supabaseAdmin.from("route_candidates").select("keywords_json").eq("from_code", from_code).eq("to_code", to_code).eq("cabin", cabin).maybeSingle(),
        ]);

        if (!page?.fare_snapshot_json) return Response.json({ ok: false, error: "No real fare snapshot for this route" }, { status: 404 });

        const from = places[from_code];
        const to = places[to_code];
        if (!from || !to) return Response.json({ ok: false, error: "Unknown place code" }, { status: 404 });

        const kwRaw = (candidate?.keywords_json as { keyword: string; avg_monthly_searches: number }[] | null) ?? [];
        const keywords = [...kwRaw].sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches).slice(0, 4);

        return Response.json({
          ok: true,
          from_code, to_code, cabin,
          from_name: from.name, to_name: to.name,
          from_iata: from.iata ?? null, to_iata: to.iata ?? null,
          to_country: to.country_code ?? "",
          keywords,
          snapshot: page.fare_snapshot_json,
        });
      },
    },
  },
});
