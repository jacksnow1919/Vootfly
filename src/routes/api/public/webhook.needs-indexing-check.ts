import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * GET/POST /api/public/webhook/needs-indexing-check?limit=30
 *
 * Returns published route pages due an indexing check, oldest-checked-first
 * so every page gets a turn rather than the same few being re-checked. A
 * page that has never been checked sorts first (indexing_checked_at NULL).
 *
 * Mirrors the proven EazAir / BCD / ASAirspace tracker contract so the same
 * n8n workflow shape works here without inventing a new one.
 */
export const Route = createFileRoute("/api/public/webhook/needs-indexing-check")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const { authorized } = await import("@/lib/seo-pages.server");
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const parsed = z
    .object({ limit: z.coerce.number().int().min(1).max(100).default(30) })
    .safeParse({ limit: url.searchParams.get("limit") ?? undefined });
  const limit = parsed.success ? parsed.data.limit : 30;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("seo_pages")
    .select("path, from_code, to_code, qa_score, fare_snapshot_json, indexing_checked_at")
    .eq("page_type", "route")
    .eq("status", "published")
    .order("indexing_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    console.error("[needs-indexing-check] read failed", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { getPlaces } = await import("@/lib/seo-pages.functions");
  const places = await getPlaces();

  const routes = (data ?? []).map((p) => {
    const snap = p.fare_snapshot_json as
      | { lowest?: { amount?: number }; fares?: { airline?: string }[] }
      | null;
    // Real airline names actually present in the real snapshot -- never a
    // claimed network, and de-duplicated so the sheet column stays readable.
    const airlines = [...new Set((snap?.fares ?? []).map((f) => f.airline).filter(Boolean))] as string[];
    return {
      slug: p.path.replace(/^\/|\/$/g, "").split("/").pop() ?? p.path,
      url: `https://www.vootfly.com${p.path}`,
      originCity: p.from_code ? (places[p.from_code]?.name ?? p.from_code) : "",
      destinationCity: p.to_code ? (places[p.to_code]?.name ?? p.to_code) : "",
      qaScore: p.qa_score,
      fare: snap?.lowest?.amount ?? null,
      airlines,
      path: p.path,
    };
  });

  return Response.json({ ok: true, count: routes.length, routes });
}
