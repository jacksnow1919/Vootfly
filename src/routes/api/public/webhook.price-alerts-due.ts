import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/price-alerts-due
 *
 * Closes the loop the fare watch card promises ("we will email you if the
 * fare drops"). Before this, alerts were captured and stored but nothing
 * ever checked or sent them -- a live promise the product did not keep.
 *
 * Compares each active alert's REAL baseline (the fare that was actually on
 * screen when the traveller asked) against the route's REAL current lowest
 * fare. Returns only genuine drops that are worth an email.
 *
 * Deliberately conservative, because an alert that cries wolf gets ignored
 * and then unsubscribed from:
 *  - No baseline recorded -> never notified. There is nothing real to
 *    measure a drop against, and inventing one would be a false claim.
 *  - Must drop by at least 5% AND $20, so a $4 wobble is not "a price drop".
 *  - Must be lower than the last price we already told them about, so the
 *    same drop is never emailed twice.
 *  - Currency must match, so a currency mismatch can never read as a saving.
 */
export const Route = createFileRoute("/api/public/webhook/price-alerts-due")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: alerts, error } = await supabaseAdmin
          .from("price_alerts")
          .select("id, email, from_code, to_code, cabin, baseline_price, baseline_currency, last_seen_price")
          .eq("is_active", true)
          .not("baseline_price", "is", null)
          .limit(2000);

        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const { data: pages } = await supabaseAdmin
          .from("seo_pages")
          .select("path, from_code, to_code, cabin, fare_snapshot_json, fare_snapshot_at")
          .eq("status", "published")
          .limit(5000);

        const current = new Map<string, { amount: number; currency: string; path: string; at: string | null }>();
        for (const p of pages ?? []) {
          const low = (p.fare_snapshot_json as { lowest?: { amount?: number; currency?: string } } | null)?.lowest;
          if (low?.amount && low.currency) {
            current.set(`${p.from_code}|${p.to_code}|${p.cabin}`, {
              amount: low.amount,
              currency: low.currency,
              path: p.path,
              at: p.fare_snapshot_at,
            });
          }
        }

        const { getPlaces } = await import("@/lib/seo-pages.functions");
        const places = await getPlaces();
        const name = (c: string) => places[c]?.name ?? c;

        const MIN_PCT = 5;
        const MIN_ABS = 20;
        const due = [];
        for (const a of alerts ?? []) {
          const now = current.get(`${a.from_code}|${a.to_code}|${a.cabin}`);
          if (!now) continue; // no real current fare -> nothing to compare
          const baseline = Number(a.baseline_price);
          if (!baseline || now.currency !== (a.baseline_currency ?? "USD")) continue;
          const drop = baseline - now.amount;
          const pct = (drop / baseline) * 100;
          if (drop < MIN_ABS || pct < MIN_PCT) continue;
          // Never re-send the same drop: must beat what we last told them.
          if (a.last_seen_price != null && now.amount >= Number(a.last_seen_price)) continue;
          due.push({
            id: a.id,
            email: a.email,
            route: `${name(a.from_code)} to ${name(a.to_code)}`,
            baseline,
            current: now.amount,
            currency: now.currency,
            dropPercent: Math.round(pct * 10) / 10,
            url: `https://www.vootfly.com${now.path}`,
            fareCheckedAt: now.at,
          });
        }

        return Response.json({ ok: true, activeWithBaseline: (alerts ?? []).length, due });
      },
    },
  },
});
