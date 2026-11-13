/**
 * pSEO hierarchy v2 (Skyscanner model): short flat URLs, deep breadcrumbs.
 * Every crumb resolves to a real hub page. Breadcrumbs are derived from the
 * places parent chain, never typed by hand or by the content agent.
 */

export type PlaceLevel = "country" | "state" | "metro" | "airport";
/**
 * Retained for compatibility with the seo_pages/PKfare data model (which still
 * partitions rows by cabin), but VootFly no longer ships a separate first-class
 * URL tree or luxury-only positioning -- every pSEO consumer below now treats
 * "business" and "first" identically and renders plain "Flights" copy. See
 * docs/VOOTFLY-STRATEGY.md.
 */
// VootFly is positioned as a lowest-price/economy platform, not the
// business-class-focused sibling project this pSEO system was originally
// modelled on -- "economy" added 2026-09-11 (was "business" | "first"
// only, with every route/hub page hardcoded to "business" throughout the
// site's route files and the W2 n8n pipeline). "business"/"first" kept
// as still-valid values rather than removed, in case a future page
// genuinely wants a premium-cabin variant, but "economy" is now the
// site-wide default everywhere that used to default to "business".
export type Cabin = "economy" | "business" | "first";

export type Place = {
  code: string;
  level: PlaceLevel;
  parent_code: string | null;
  name: string;
  slug_name: string;
  country_code: string;
  iata: string | null;
  region: string | null;
  is_us_gateway: boolean;
  single_airport: boolean;
  sort_order: number;
};

export type PlaceMap = Record<string, Place>;

export type Crumb = { name: string; path: string | null };

/** No longer varies by cabin -- kept so existing call sites don't need signature changes. */
export const CABIN_LABEL: Record<Cabin, string> = {
  economy: "Flights",
  business: "Flights",
  first: "Flights",
};

export const REGION_LABEL: Record<string, string> = {
  "north-america": "North America",
  "south-america": "South America",
  europe: "Europe",
  "middle-east": "Middle East",
  africa: "Africa",
  asia: "Asia",
  oceania: "Oceania",
};

/** Walk parents up to the country. Returns [country, state?, metro, airport?] order. */
export function chain(places: PlaceMap, code: string): Place[] {
  const out: Place[] = [];
  let cur: Place | undefined = places[code];
  let guard = 0;
  while (cur && guard++ < 8) {
    out.unshift(cur);
    cur = cur.parent_code ? places[cur.parent_code] : undefined;
  }
  return out;
}

/** Always /flights -- the first-class-only URL tree was retired. */
export function routeRoot(_cabin: Cabin): string {
  return "/flights";
}

/** Canonical route path: /flights/{from}/{to}/{from-slug}-to-{to-slug}/ */
export function routePath(places: PlaceMap, from: string, to: string, cabin: Cabin = "economy"): string | null {
  const a = places[from];
  const b = places[to];
  if (!a || !b) return null;
  return `${routeRoot(cabin)}/${a.code}/${b.code}/${a.slug_name}-to-${b.slug_name}/`;
}

export function routeSlug(places: PlaceMap, from: string, to: string): string | null {
  const a = places[from];
  const b = places[to];
  if (!a || !b) return null;
  return `${a.slug_name}-to-${b.slug_name}`;
}

export function originHubPath(code: string): string {
  return `/flights-from/${code}/`;
}

export function destinationHubPath(code: string, _cabin: Cabin = "economy"): string {
  return `/flights-to/${code}/`;
}

/** Breadcrumb for a route page: Home > Flights > US > NY > NYC > [JFK] > London > [LHR] */
export function routeCrumbs(places: PlaceMap, from: string, to: string, cabin: Cabin = "economy"): Crumb[] {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Flights", path: routeRoot(cabin) + "/" },
  ];
  for (const p of chain(places, from)) crumbs.push({ name: p.name, path: originHubPath(p.code) });
  // Destination side: skip the country only when it equals the origin country (domestic) to avoid "US > ... > US".
  const fromCountry = places[from]?.country_code;
  for (const p of chain(places, to)) {
    if (p.level === "country" && p.code === fromCountry) continue;
    crumbs.push({ name: p.name, path: destinationHubPath(p.code, cabin) });
  }
  if (crumbs.length) crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1]!, path: null };
  return crumbs;
}

/** Breadcrumb for an origin hub: Home > Flights > Flights from > US > NY > NYC > JFK */
export function originHubCrumbs(places: PlaceMap, code: string): Crumb[] {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Flights", path: "/flights/" },
    { name: "Flights from", path: "/flights-from/" },
  ];
  for (const p of chain(places, code)) crumbs.push({ name: p.name, path: originHubPath(p.code) });
  crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1]!, path: null };
  return crumbs;
}

/** Breadcrumb for a destination hub: Home > Flights > Flights to > GB > London > LHR */
export function destinationHubCrumbs(places: PlaceMap, code: string, cabin: Cabin = "economy"): Crumb[] {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Flights", path: routeRoot(cabin) + "/" },
    { name: "Flights to", path: "/flights-to/" },
  ];
  for (const p of chain(places, code)) crumbs.push({ name: p.name, path: destinationHubPath(p.code, cabin) });
  crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1]!, path: null };
  return crumbs;
}

export function breadcrumbJsonLd(crumbs: Crumb[], origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: origin + c.path } : {}),
    })),
  };
}

/** "New York City" for a metro, "New York JFK (JFK)" for an airport. */
export function placeLabel(p: Place): string {
  if (p.level === "airport") return `${p.name} (${p.iata})`;
  if (p.level === "metro" && p.single_airport && p.iata) return `${p.name} (${p.iata})`;
  return p.name;
}

export function defaultRouteTitle(places: PlaceMap, from: string, to: string, cabin: Cabin, lowestFare?: { amount: number; currency: string } | null): string {
  const a = places[from];
  const b = places[to];
  if (!a || !b) return "Route";
  const base = `Flights ${a.name} to ${b.name}`;
  return lowestFare ? `${base} from ${formatMoney(lowestFare.amount, lowestFare.currency)} | VootFly` : `${base} | VootFly`;
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

/** Fare snapshot shape written by the n8n fare-refresh workflow from real PKfare results. */
export type FareSnapshot = {
  lowest: { amount: number; currency: string; airline?: string; airline_code?: string; depart_date?: string; return_date?: string } | null;
  fares?: {
    amount: number;
    currency: string;
    airline?: string;
    airline_code?: string;
    depart_date?: string;
    return_date?: string;
    stops?: number;
    duration_minutes?: number;
    /** The cabin PKFARE actually RETURNED for this fare, not the cabin we
     * asked for. Preserved from 2026-09-16 so a returned-vs-requested
     * mismatch is visible in stored data instead of silently accepted. */
    cabin?: string;
    /** Supplier that returned this fare (14 Nov 2026). */
    supplier?: string;
    /** Airlines flying the outbound journey when none of them sells the fare, e.g. ["AA"]
     * on a fare sold by Iberia (14 Nov 2026). From the supplier's segment data. */
    operated_by?: string[];
  }[];
  /** Set when any returned fare's cabin did not match the requested cabin. */
  cabin_mismatch?: { requested: string; returned: string[] };
  by_month?: { month: string; lowest: number; currency: string }[];
  /** When by_month was actually fetched. Carried separately from fetched_at
   * because the monthly breakdown is refreshed far less often than the
   * headline fare (see applyFareSnapshot) -- so it must never be presented
   * as being as current as the headline price. */
  by_month_fetched_at?: string;
  fetched_at: string;
  source: "pkfare" | "duffel" | "mcontent";
  /** Adults the supplier search was run for (recorded from 13 Nov 2026; older snapshots lack it). */
  adults?: number;
  /** Round trip or one way, as searched (recorded from 13 Nov 2026). */
  trip?: "round_trip" | "one_way";
  /** The airport codes the supplier search actually used, e.g. DFW to LHR for a
   * Dallas to London page (recorded from 13 Nov 2026). */
  searched?: { origin: string; destination: string };
};

export const SNAPSHOT_MAX_AGE_DAYS = 7;

export function snapshotIsFresh(fetchedAt: string | null | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return false;
  const t = Date.parse(fetchedAt);
  return Number.isFinite(t) && now - t < SNAPSHOT_MAX_AGE_DAYS * 86_400_000;
}

/** "2026-12-28" -> "Dec 28, 2026", read as a calendar day in UTC so the server and
 * a browser in any time zone print the same day (13 Nov 2026). */
export function formatUtcDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
}

/** Check time with its time zone: "Nov 13, 2026, 2:05 PM UTC". */
export function formatUtcCheckTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

/**
 * Strict "may we show this price" check (added 13 Nov 2026), used by route pages
 * on the strict template (content_json.template === 2). A price is shown only when
 * every fact needed to describe it is in the stored supplier result: a real
 * amount in USD (what Price converts from), the passenger count, the travel
 * dates, and a check date under SNAPSHOT_MAX_AGE_DAYS old with a departure that
 * has not already passed. Anything missing means no price, never a filled gap.
 */
export function isLiveSnapshot(
  s: FareSnapshot | null | undefined,
  now = Date.now(),
): s is FareSnapshot & {
  lowest: NonNullable<FareSnapshot["lowest"]> & { depart_date: string };
  adults: number;
} {
  const low = s?.lowest;
  if (!s || !low) return false;
  if (!(typeof low.amount === "number" && low.amount > 0) || low.currency !== "USD") return false;
  if (!(typeof s.adults === "number" && s.adults > 0)) return false;
  if (!low.depart_date || !snapshotIsFresh(s.fetched_at, now)) return false;
  if (s.trip === "round_trip" && !low.return_date) return false;
  const today = new Date(now).toISOString().slice(0, 10);
  return low.depart_date.slice(0, 10) >= today;
}

/**
 * Collapses fares that render identically in the UI (same airline, price,
 * duration, stops) down to one, keeping the first (cheapest, since callers
 * pass an already price-sorted list). Two real PKFARE solutions can differ
 * only in a fare-class or booking code this UI never shows, which reads as
 * a duplicated/fake row even though the underlying data is real. Never
 * merges fares that actually differ on anything shown.
 */
export function dedupeSimilarFares<T extends { airline?: string; amount: number; duration_minutes?: number; stops?: number }>(
  fares: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const f of fares) {
    const key = `${f.airline ?? ""}|${f.amount}|${f.duration_minutes ?? ""}|${f.stops ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
