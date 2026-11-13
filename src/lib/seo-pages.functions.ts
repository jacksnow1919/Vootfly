import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  chain,
  destinationHubCrumbs,
  originHubCrumbs,
  routeCrumbs,
  routePath,
  type Cabin,
  type Place,
  type PlaceMap,
} from "@/lib/hierarchy";
import { resolveDestinationPhoto, type StoredPhotoRow } from "@/lib/destination-images";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ---- places cache (small table, refreshed every 10 minutes per server instance) ----
let placesCache: { at: number; map: PlaceMap } | null = null;
const PLACES_TTL_MS = 10 * 60 * 1000;

/**
 * Exported so other server code (e.g. pkfare.functions.ts) can resolve a
 * multi-airport-metro code to a real searchable airport code without a
 * second round-trip through the getPlaces server function. Same 10-minute
 * cache either way.
 */
export async function loadPlaces(): Promise<PlaceMap> {
  if (placesCache && Date.now() - placesCache.at < PLACES_TTL_MS) return placesCache.map;
  const { data, error } = await publicClient()
    .from("places")
    .select("code, level, parent_code, name, slug_name, country_code, iata, region, is_us_gateway, single_airport, sort_order")
    .limit(5000);
  if (error || !data) return placesCache?.map ?? {};
  const map: PlaceMap = {};
  for (const r of data) map[r.code] = r as Place;
  placesCache = { at: Date.now(), map };
  return map;
}

// qa_score, indexed_status, indexed_checked_at are intentionally excluded: Lovable's security
// migration restricts anon/authenticated reads to this exact column set on seo_pages, and those
// three are internal-only (read via service_role in the webhook endpoints, not on the public site).
const PAGE_COLUMNS =
  "id, page_type, path, from_code, to_code, airline_slug, cabin, facet, meta_title, meta_description, content_json, fare_snapshot_json, fare_snapshot_at, status, updated_at";

export type SeoPageRow = Database["public"]["Tables"]["seo_pages"]["Row"];
type PageSummary = Pick<
  SeoPageRow,
  "path" | "from_code" | "to_code" | "cabin" | "meta_title" | "fare_snapshot_json" | "fare_snapshot_at" | "status"
>;

/** Every code under a place (itself + descendants), used so a hub for NYC also lists JFK/EWR/LGA routes.
 * Exported (2026-09-16) so the sitemap can use the exact same "does this hub have real content"
 * logic as the hub page itself -- rather than a second, possibly-drifting implementation. */
export function descendantCodes(places: PlaceMap, code: string): string[] {
  const out = [code];
  const stack = [code];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const p of Object.values(places)) {
      if (p.parent_code === cur) {
        out.push(p.code);
        stack.push(p.code);
      }
    }
  }
  return out;
}

export const getPlaces = createServerFn({ method: "GET" }).handler(async () => loadPlaces());

// ---- destination photos (picked from Pixabay and stored in VootFly's own storage) ----
// Short cache so a newly saved photo shows within a few minutes.
let photosCache: { at: number; map: Record<string, StoredPhotoRow> } | null = null;
const PHOTOS_TTL_MS = 5 * 60 * 1000;

export async function loadStoredPhotos(): Promise<Record<string, StoredPhotoRow>> {
  if (photosCache && Date.now() - photosCache.at < PHOTOS_TTL_MS) return photosCache.map;
  const { data, error } = await publicClient()
    .from("destination_photos")
    .select("place_code, source, public_url, thumb_url, alt, credit, source_page_url")
    .limit(1000);
  if (error || !data) return photosCache?.map ?? {};
  const map: Record<string, StoredPhotoRow> = {};
  for (const r of data) map[r.place_code] = r;
  photosCache = { at: Date.now(), map };
  return map;
}

/** Saved destination photos keyed by place code (homepage cards). */
export const listDestinationPhotos = createServerFn({ method: "GET" }).handler(async () => loadStoredPhotos());

export const getRoutePage = createServerFn({ method: "GET" })
  .inputValidator((d: { from: string; to: string; cabin: Cabin }) => d)
  .handler(async ({ data }) => {
    const places = await loadPlaces();
    const from = places[data.from];
    const to = places[data.to];
    if (!from || !to) return null;
    const canonicalPath = routePath(places, from.code, to.code, data.cabin)!;
    // Local preview of pages that are not public yet (13 Nov 2026). The public key
    // cannot read a pending row, so it 404s locally as well as live. Only on the Vite
    // dev server and only with ROUTE_PREVIEW=1 set locally; import.meta.env.DEV is
    // false in every production build, so the live site never takes this branch.
    const preview = import.meta.env.DEV && process.env["ROUTE_PREVIEW"] === "1";
    const pageClient = preview
      ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
      : publicClient();
    const { data: row } = await pageClient
      .from("seo_pages")
      .select(PAGE_COLUMNS)
      .eq("page_type", "route")
      .eq("from_code", from.code)
      .eq("to_code", to.code)
      .eq("cabin", data.cabin)
      .maybeSingle();

    // Siblings for internal linking (F5): 4 from same origin, 4 to same destination.
    const client = publicClient();
    const [{ data: fromSiblings }, { data: toSiblings }, { data: liveRoutes }] = await Promise.all([
      client
        .from("seo_pages")
        .select("path, from_code, to_code, cabin, meta_title, fare_snapshot_json, fare_snapshot_at, status")
        .eq("page_type", "route")
        .eq("cabin", data.cabin)
        .eq("from_code", from.code)
        .neq("to_code", to.code)
        .eq("status", "published")
        .limit(4),
      client
        .from("seo_pages")
        .select("path, from_code, to_code, cabin, meta_title, fare_snapshot_json, fare_snapshot_at, status")
        .eq("page_type", "route")
        .eq("cabin", data.cabin)
        .eq("to_code", to.code)
        .neq("from_code", from.code)
        .eq("status", "published")
        .limit(4),
      // Every live route path (added 29 Oct 2026). The "By airport" block used
      // to link every airport-level variant of a route whether or not a page
      // existed, so each route page carried 2 to 5 links to 404s (for example
      // /flights/jfk/par/jfk-airport-to-paris/). Those links are now filtered
      // to paths in this list.
      client.from("seo_pages").select("path").eq("page_type", "route").eq("status", "published").limit(1000),
    ]);

    // A real photo of the destination (its own, or its city's for an airport), or null.
    const photo = resolveDestinationPhoto(to.code, to.parent_code, await loadStoredPhotos());

    return {
      page: row as SeoPageRow | null,
      photo,
      canonicalPath,
      from,
      to,
      fromChain: chain(places, from.code),
      toChain: chain(places, to.code),
      crumbs: routeCrumbs(places, from.code, to.code, data.cabin),
      siblings: {
        fromSameOrigin: (fromSiblings ?? []) as PageSummary[],
        toSameDestination: (toSiblings ?? []) as PageSummary[],
      },
      publishedPaths: (liveRoutes ?? []).map((r) => r.path as string),
      places,
    };
  });

export const getOriginHub = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const places = await loadPlaces();
    const place = places[data.code];
    if (!place) return null;
    const codes = descendantCodes(places, place.code);
    const { data: routes } = await publicClient()
      .from("seo_pages")
      .select("path, from_code, to_code, cabin, meta_title, fare_snapshot_json, fare_snapshot_at, status")
      .eq("page_type", "route")
      .in("from_code", codes)
      .in("status", ["published", "noindex"])
      .order("fare_snapshot_at", { ascending: false })
      .limit(500);
    const children = Object.values(places)
      .filter((p) => p.parent_code === place.code)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    return {
      place,
      chain: chain(places, place.code),
      crumbs: originHubCrumbs(places, place.code),
      children,
      routes: (routes ?? []) as PageSummary[],
      places,
    };
  });

export const getDestinationHub = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string; cabin: Cabin }) => d)
  .handler(async ({ data }) => {
    const places = await loadPlaces();
    const place = places[data.code];
    if (!place) return null;
    const codes = descendantCodes(places, place.code);
    const { data: routes } = await publicClient()
      .from("seo_pages")
      .select("path, from_code, to_code, cabin, meta_title, fare_snapshot_json, fare_snapshot_at, status")
      .eq("page_type", "route")
      .eq("cabin", data.cabin)
      .in("to_code", codes)
      .in("status", ["published", "noindex"])
      .order("fare_snapshot_at", { ascending: false })
      .limit(500);
    const children = Object.values(places)
      .filter((p) => p.parent_code === place.code)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    return {
      place,
      chain: chain(places, place.code),
      crumbs: destinationHubCrumbs(places, place.code, data.cabin),
      children,
      routes: (routes ?? []) as PageSummary[],
      places,
    };
  });

/** Hub index: all US gateways (origin side) or all destination countries (destination side). */
export const listHubEntities = createServerFn({ method: "GET" })
  .inputValidator((d: { side: "origin" | "destination" }) => d)
  .handler(async ({ data }) => {
    const places = await loadPlaces();
    const all = Object.values(places);
    if (data.side === "origin") {
      return all.filter((p) => p.level === "metro" && p.is_us_gateway).sort((a, b) => a.sort_order - b.sort_order);
    }
    return all
      .filter((p) => p.level === "metro" && !p.is_us_gateway)
      .sort((a, b) => (a.region ?? "").localeCompare(b.region ?? "") || a.sort_order - b.sort_order);
  });

/** Indexable paths for the sitemap: published pages only (F1/F6).
 * from_code/to_code included (2026-09-16) so the sitemap can determine which
 * hub pages have real route content behind them, not just which pages exist. */
export const listPublishedPaths = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("seo_pages")
    .select("path, page_type, updated_at, from_code, to_code")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(20000);
  return data ?? [];
});

/**
 * Route guides that are their own file in src/routes rather than a seo_pages row (4 Nov 2026),
 * so the directory pages and the HTML sitemap link to them too. Each also needs an entry in
 * STATIC_PATHS in sitemap[.]xml.ts.
 */
const STATIC_ROUTE_GUIDES = [{ path: "/flights/atl/pdx/atlanta-to-portland/", from: "Atlanta", to: "Portland" }];

/**
 * Crawlable index of every live route page (added 29 Oct 2026), for /flights/,
 * /flights-from/, /flights-to/ and the /sitemap page. Before this, /flights/
 * linked to no route page at all and the HTML sitemap listed none, so most
 * route pages were reachable only through the XML sitemap and a few homepage
 * cards, and Google reported 8 of 14 as "URL is unknown to Google".
 *
 * Also returns the origin and destination hub codes that have at least one
 * live route beneath them (same rule the XML sitemap uses), so the index
 * pages stop linking to empty "being prepared" hubs.
 */
export const listLiveRouteIndex = createServerFn({ method: "GET" }).handler(async () => {
  const places = await loadPlaces();
  const { data } = await publicClient()
    .from("seo_pages")
    .select("path, from_code, to_code")
    .eq("page_type", "route")
    .eq("status", "published")
    .limit(1000);
  const rows = (data ?? []).filter((r): r is { path: string; from_code: string; to_code: string } => !!r.path && !!r.from_code && !!r.to_code);
  const routes = [
    ...rows.map((r) => ({
      path: r.path,
      from: places[r.from_code]?.name ?? r.from_code.toUpperCase(),
      to: places[r.to_code]?.name ?? r.to_code.toUpperCase(),
    })),
    ...STATIC_ROUTE_GUIDES,
  ].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const fromCodes = new Set(rows.map((r) => r.from_code));
  const toCodes = new Set(rows.map((r) => r.to_code));
  const all = Object.values(places);
  const originHubCodes = all.filter((p) => descendantCodes(places, p.code).some((c) => fromCodes.has(c))).map((p) => p.code);
  const destinationHubCodes = all.filter((p) => descendantCodes(places, p.code).some((c) => toCodes.has(c))).map((p) => p.code);
  return { routes, originHubCodes, destinationHubCodes };
});

/** Real published routes with their real lowest fares, for the homepage
 * "popular routes" list and deal cards. Replaces the old hardcoded price
 * arrays ($399/$100/$640 etc.) that never matched real fares -- the same
 * placeholder-price problem fixed on route pages. Returns only routes that
 * genuinely have a real fare snapshot; a route with no real lowest fare is
 * omitted rather than shown with an invented number. */
export const listHomeRoutes = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient()
    .from("seo_pages")
    .select("path, from_code, to_code, fare_snapshot_json, fare_snapshot_at")
    .eq("page_type", "route")
    .eq("status", "published")
    .limit(200);
  type Snap = {
    lowest?: { amount?: number; currency?: string; airline?: string; airline_code?: string; return_date?: string };
    fares?: { amount?: number; airline_code?: string; cabin?: string }[];
  };
  const rows = (data ?? [])
    .map((r) => {
      const snap = r.fare_snapshot_json as Snap | null;
      const low = snap?.lowest;
      if (!low || typeof low.amount !== "number") return null;
      // Verified economy (added 30 Sep 2026, homepage integrity rule): the stored
      // lowest fare must appear in the stored supplier results with the cabin the
      // SUPPLIER returned recorded as economy. A page whose snapshot lacks that
      // (for example one written without the cabin field) is not shown with a price.
      const match = (snap?.fares ?? []).find(
        (f) => f.amount === low.amount && (f.airline_code ?? null) === (low.airline_code ?? null),
      );
      const economyVerified = Boolean(match?.cabin && /^econom/i.test(match.cabin));
      return {
        path: r.path,
        from_code: r.from_code,
        to_code: r.to_code,
        amount: low.amount,
        currency: low.currency ?? "USD",
        airline: low.airline ?? null,
        // When this fare was last checked, so cards can say so (30 Sep 2026).
        checked_at: r.fare_snapshot_at ?? null,
        round_trip: Boolean(low.return_date),
        economy_verified: economyVerified,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.amount - b.amount);
  return rows;
});

/** Old /flights/{slug} pages: find the v2 path to 301 to. */
export const resolveLegacySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { data: row } = await publicClient()
      .from("seo_pages")
      .select("path")
      .eq("legacy_slug", data.slug)
      .maybeSingle();
    if (row?.path) return row.path;
    // Fallback: derive from "x-to-y" against metro slugs so unmigrated legacy slugs still redirect.
    const [a, b] = data.slug.split("-to-");
    if (!a || !b) return null;
    const places = await loadPlaces();
    const from = Object.values(places).find((p) => p.level === "metro" && p.slug_name === a);
    const to = Object.values(places).find((p) => p.level === "metro" && p.slug_name === b);
    if (!from || !to) return null;
    return routePath(places, from.code, to.code, "economy");
  });
