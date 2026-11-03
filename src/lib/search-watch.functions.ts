/**
 * Phase tracker 5.4 (activation): offer a price alert right after a search.
 *
 * Only offered when the searched route has a published VootFly route page,
 * because that page's fare is what the daily price-alert check compares
 * against. Airports resolve to their city (JFK -> New York) through the
 * places table. The alert's starting price is the route's TRACKED lowest
 * fare, not the specific dates just searched: otherwise a search on
 * expensive dates would trigger an instant "price dropped" email that is
 * really just a different date.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SearchWatch = {
  fromCode: string; toCode: string; fromName: string; toName: string;
  baselinePrice: number; baselineCurrency: string; path: string;
};

export const getSearchWatch = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ origin: z.string().min(3).max(3), destination: z.string().min(3).max(3) }).parse(d))
  .handler(async ({ data }): Promise<SearchWatch | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("places")
      .select("code, level, iata, parent_code, name")
      .in("iata", [data.origin.toUpperCase(), data.destination.toUpperCase()]);
    const cityOf = (iata: string) => {
      const p = (rows ?? []).find((r) => (r.iata ?? "").toUpperCase() === iata.toUpperCase());
      if (!p) return null;
      return p.level === "airport" ? p.parent_code : p.code;
    };
    const from = cityOf(data.origin), to = cityOf(data.destination);
    if (!from || !to) return null;
    const { data: page } = await supabaseAdmin
      .from("seo_pages")
      .select("path, fare_snapshot_json")
      .eq("page_type", "route").eq("status", "published").eq("cabin", "economy")
      .eq("from_code", from).eq("to_code", to)
      .maybeSingle();
    const low = (page?.fare_snapshot_json as { lowest?: { amount?: number; currency?: string } } | null)?.lowest;
    if (!page || typeof low?.amount !== "number") return null;
    const { data: names } = await supabaseAdmin.from("places").select("code, name").in("code", [from, to]);
    const nm = (c: string) => (names ?? []).find((n) => n.code === c)?.name ?? c.toUpperCase();
    return { fromCode: from, toCode: to, fromName: nm(from), toName: nm(to), baselinePrice: low.amount, baselineCurrency: low.currency ?? "USD", path: page.path };
  });
