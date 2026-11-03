import type { PlaceMap } from "@/lib/hierarchy";

/** One real published route with its real lowest fare (from listHomeRoutes). */
export type HomeRoute = {
  path: string;
  from_code: string | null;
  to_code: string | null;
  amount: number;
  currency: string;
  airline: string | null;
  checked_at: string | null;
  round_trip: boolean;
  /** The supplier's own returned cabin for this fare is economy (see listHomeRoutes). */
  economy_verified: boolean;
};

// Main airport for a city when the places table has no single IATA code.
// Used only to pre-fill live searches; never to show a price.
const FALLBACK_AIRPORT: Record<string, string> = {
  nyc: "JFK", lon: "LHR", chi: "ORD", lax: "LAX", tyo: "NRT", mia: "MIA", mad: "MAD", par: "CDG", rom: "FCO", auh: "AUH",
  las: "LAS", orl: "MCO", atl: "ATL", was: "IAD", dfw: "DFW", sfo: "SFO", sea: "SEA",
};
// Abu Dhabi, Las Vegas, Orlando and Atlanta are only used on homepage Popular routes cards (owner
// request, 31 Oct 2026), not added to the places table, so nothing else on the site changes.
const FALLBACK_NAME: Record<string, string> = {
  mia: "Miami", mad: "Madrid", lax: "Los Angeles", chi: "Chicago", auh: "Abu Dhabi",
  las: "Las Vegas", orl: "Orlando", atl: "Atlanta",
  was: "Washington D.C.", dfw: "Dallas", sfo: "San Francisco", sea: "Seattle",
};

export function cityName(code: string | null | undefined, places: PlaceMap): string {
  if (!code) return "";
  return places[code]?.name ?? FALLBACK_NAME[code] ?? code.toUpperCase();
}

export function primaryAirport(code: string, places: PlaceMap): string {
  const p = places[code];
  if (p?.iata) return p.iata;
  const child = Object.values(places)
    .filter((x) => x.parent_code === code && x.level === "airport" && x.iata)
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  return child?.iata ?? FALLBACK_AIRPORT[code] ?? code.toUpperCase();
}

/** When a stored fare was checked, with date and time (UTC), e.g. "Checked Oct 29, 9:32 AM UTC". */
export function checkedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return `Checked ${date}, ${time} UTC`;
}

/** How long ago a stored fare was checked, e.g. "Checked 3 hours ago" (owner rule, 1 Nov 2026). */
export function checkedAgo(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 60) return mins <= 1 ? "Checked just now" : `Checked ${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Checked ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `Checked ${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Label for any stored (not live) fare on the homepage (owner rule, 31 Oct 2026).
 * Stored fares come from route_page fare snapshots: the lowest fare a real supplier
 * search returned for that route, saved with the time it was checked.
 */
export const TRACKED_FARE_LABEL = "Recently Tracked Fare";
export const FARE_SOURCE_NOTE = "Source: VootFly's stored results from real airline fare searches on the routes shown.";
export const NO_DEALS_MESSAGE = "No verified flight deals available right now. Search for a route to see current fares.";

export function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - Date.parse(iso)) / 86_400_000;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Standard VootFly fare disclaimer, reproduced word for word from the site. */
export const FARE_DISCLAIMER =
  "Fares shown are the lowest found at the time of the snapshot, per person, and are subject to availability and change at the time of booking.";

/** A stored fare is shown with a price only if it is recent. */
export const FRESH_DAYS = 7;

/**
 * The homepage's single rule for showing a price (30 Sep 2026): the fare must come
 * from the stored supplier results, the supplier must have returned economy for it,
 * and it must have been checked within the last 7 days. Anything else shows no
 * price, only "Search current fares". Less content is better than unverified content.
 */
export function hasVerifiedPrice(r: HomeRoute): boolean {
  return r.economy_verified && daysSince(r.checked_at) <= FRESH_DAYS;
}
