import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/fare-report-weekly   (phase tracker 3.1 and 3.3)
 *
 * One weekly read of real fare history:
 * - movements: latest vs previous real reading per route (8% and $25 minimum,
 *   same thresholds as detectFareMovements), suspect readings excluded;
 * - suspect: readings held back in the last 7 days as likely data errors
 *   (below 0.4x or above 3x the route's usual price);
 * - stale: published route pages whose fare has not been refreshed in 9 days
 *   (the slowest refresh tier is 7 days, plus 2 days' grace);
 * - bestByOrigin: from each departure city, the route whose current fare is
 *   furthest below its usual price (usual = median of the last 20 real
 *   readings, only judged with 3 or more readings).
 * A failed read returns ok:false, never an empty "nothing happened" report.
 */
export const Route = createFileRoute("/api/public/webhook/fare-report-weekly")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getPlaces } = await import("@/lib/seo-pages.functions");
        const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
        const [obsRes, pagesRes, places] = await Promise.all([
          supabaseAdmin.from("fare_observations").select("from_code, to_code, price, suspect, observed_at")
            .eq("cabin", "economy").gte("observed_at", since).order("observed_at", { ascending: false }).limit(5000),
          supabaseAdmin.from("seo_pages").select("path, from_code, to_code, fare_snapshot_json, fare_snapshot_at")
            .eq("status", "published").eq("page_type", "route").limit(5000),
          getPlaces(),
        ]);
        if (obsRes.error || pagesRes.error) return Response.json({ ok: false, error: (obsRes.error ?? pagesRes.error)!.message });

        const name = (c: string | null) => (c ? (places[c]?.name ?? c.toUpperCase()) : "?");
        const route = (f: string | null, t: string | null) => `${name(f)} to ${name(t)}`;
        const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2; };

        type Obs = { price: number; suspect: boolean; observed_at: string };
        const byRoute = new Map<string, Obs[]>();
        for (const o of obsRes.data ?? []) {
          const k = `${o.from_code}|${o.to_code}`;
          (byRoute.get(k) ?? byRoute.set(k, []).get(k)!).push({ price: Number(o.price), suspect: o.suspect, observed_at: o.observed_at });
        }
        const usualOf = (k: string) => {
          const real = (byRoute.get(k) ?? []).filter((o) => !o.suspect).slice(0, 20).map((o) => o.price);
          return real.length >= 3 ? { usual: Math.round(median(real)), history: real.length } : { usual: null, history: real.length };
        };

        const movements = [];
        for (const [k, obs] of byRoute) {
          const real = obs.filter((o) => !o.suspect);
          if (real.length < 2) continue;
          const [latest, prev] = real as [Obs, Obs];
          const change = latest.price - prev.price; const pct = prev.price > 0 ? (change / prev.price) * 100 : 0;
          if (Math.abs(pct) < 8 || Math.abs(change) < 25) continue;
          const [f, t] = k.split("|") as [string, string];
          movements.push({ route: route(f, t), from: prev.price, to: latest.price, changePercent: Math.round(pct * 10) / 10, direction: change < 0 ? "drop" : "spike", at: latest.observed_at });
        }

        const weekAgo = Date.now() - 7 * 86_400_000;
        const suspect = (obsRes.data ?? []).filter((o) => o.suspect && Date.parse(o.observed_at) >= weekAgo)
          .map((o) => ({ route: route(o.from_code, o.to_code), price: Number(o.price), usual: usualOf(`${o.from_code}|${o.to_code}`).usual, at: o.observed_at }));

        const staleCut = Date.now() - 9 * 86_400_000;
        const pages = pagesRes.data ?? [];
        const stale = pages.filter((p) => !p.fare_snapshot_at || Date.parse(p.fare_snapshot_at) < staleCut)
          .map((p) => ({ route: route(p.from_code, p.to_code), lastRefreshed: p.fare_snapshot_at }));

        const byOrigin = new Map<string, { route: string; current: number; usual: number | null; pctBelow: number | null; history: number; path: string }[]>();
        for (const p of pages) {
          const current = (p.fare_snapshot_json as { lowest?: { amount?: number } } | null)?.lowest?.amount;
          if (typeof current !== "number" || !p.from_code) continue;
          const u = usualOf(`${p.from_code}|${p.to_code}`);
          const pctBelow = u.usual ? Math.round(((u.usual - current) / u.usual) * 100) : null;
          (byOrigin.get(p.from_code) ?? byOrigin.set(p.from_code, []).get(p.from_code)!)
            .push({ route: route(p.from_code, p.to_code), current, usual: u.usual, pctBelow, history: u.history, path: p.path });
        }
        const bestByOrigin = [...byOrigin.entries()].map(([origin, list]) => {
          const judged = list.filter((x) => x.pctBelow !== null).sort((a, b) => b.pctBelow! - a.pctBelow!);
          const pick = judged[0] ?? [...list].sort((a, b) => a.current - b.current)[0]!;
          return { origin: name(origin), ...pick, basis: judged.length ? "vs usual price" : "cheapest now (not enough history to compare)" };
        }).sort((a, b) => (b.pctBelow ?? -999) - (a.pctBelow ?? -999));

        return Response.json({
          ok: true, generatedAt: new Date().toISOString(),
          routesTotal: pages.length, routesJudged: pages.filter((p) => usualOf(`${p.from_code}|${p.to_code}`).usual !== null).length,
          movements, suspect, stale, bestByOrigin,
        });
      },
    },
  },
});
