/**
 * Fare Intelligence — Phase 3 Foundation.
 *
 * Reads real fare_observations (Phase 3 table, seeded only from real
 * seo_pages snapshots -- see the migration comment on that table) and
 * real PKFARE live data via the existing, unmodified pkfare.server.ts.
 * Never computes/estimates a price; a route with too few real
 * observations to say something meaningful about trend says so
 * explicitly rather than guessing.
 *
 * This does not touch or call into W1/W2/W6, evaluateStatus, or any part
 * of the existing SEO pipeline -- it only reads fare_observations and
 * seo_pages (read-only), tables/queries that pipeline already writes to
 * for its own purposes.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FareIntelligenceReport = {
  fromCode: string;
  toCode: string;
  cabin: string;
  /** How many real observations this report is based on. */
  observationCount: number;
  /** Null when observationCount is 0 -- never a fabricated "no data" price. */
  lowestObserved: { price: number; currency: string; observedAt: string; airlineIata: string | null } | null;
  highestObserved: { price: number; currency: string; observedAt: string } | null;
  /** Null unless there are genuinely 2+ observations spanning different
   * times -- a single snapshot has no real trend, and this never
   * interpolates one. */
  trend: "insufficient_data" | "rising" | "falling" | "flat";
  earliestObservedAt: string | null;
  latestObservedAt: string | null;
  dataSource: "fare_observations (real, supplier-sourced)";
};

export async function getFareIntelligence(fromCode: string, toCode: string, cabin: string): Promise<FareIntelligenceReport> {
  const { data, error } = await supabaseAdmin
    .from("fare_observations")
    .select("price, currency, airline_iata, observed_at")
    .eq("from_code", fromCode)
    .eq("to_code", toCode)
    .eq("cabin", cabin)
    .order("observed_at", { ascending: true });

  if (error) {
    console.error("[getFareIntelligence] read failed", error);
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return {
      fromCode,
      toCode,
      cabin,
      observationCount: 0,
      lowestObserved: null,
      highestObserved: null,
      trend: "insufficient_data",
      earliestObservedAt: null,
      latestObservedAt: null,
      dataSource: "fare_observations (real, supplier-sourced)",
    };
  }

  const lowest = rows.reduce((min, r) => (r.price < min.price ? r : min), rows[0]!);
  const highest = rows.reduce((max, r) => (r.price > max.price ? r : max), rows[0]!);

  let trend: FareIntelligenceReport["trend"] = "insufficient_data";
  if (rows.length >= 2) {
    const first = rows[0]!.price;
    const last = rows[rows.length - 1]!.price;
    trend = last > first ? "rising" : last < first ? "falling" : "flat";
  }

  return {
    fromCode,
    toCode,
    cabin,
    observationCount: rows.length,
    lowestObserved: {
      price: lowest.price,
      currency: lowest.currency,
      observedAt: lowest.observed_at,
      airlineIata: lowest.airline_iata,
    },
    highestObserved: { price: highest.price, currency: highest.currency, observedAt: highest.observed_at },
    trend,
    earliestObservedAt: rows[0]!.observed_at,
    latestObservedAt: rows[rows.length - 1]!.observed_at,
    dataSource: "fare_observations (real, supplier-sourced)",
  };
}

/**
 * Records a new real observation. Callers must supply a genuinely observed
 * price (e.g. from a live PKFARE search) -- this function does not fetch
 * or verify anything itself, and must never be called with an estimated
 * or placeholder value. Not wired into any existing pipeline other than
 * the W6 webhook that calls this explicitly.
 *
 * An exact repeat of an already-recorded observation (same route/cabin/
 * price/currency/airline/observed_at -- e.g. a retried webhook call after
 * a network hiccup, still describing the identical real event) hits
 * fare_observations_no_exact_dupe and is treated as success, not failure --
 * the observation IS recorded, just not a second time. Any other error is
 * a genuine failure.
 */
export async function recordFareObservation(input: {
  fromCode: string;
  toCode: string;
  cabin: string;
  price: number;
  currency: string;
  airlineIata: string | null;
  supplierCode: string;
  source: string;
  observedAt: string;
}): Promise<{ ok: boolean; duplicate?: boolean; suspect?: boolean }> {
  // Phase 3.1: flag a reading that looks impossible for this route, so it
  // never feeds "usual" prices, drop alerts or the weekly fare report.
  const check = await checkSuspectFare(input.fromCode, input.toCode, input.cabin, input.price);
  const { error } = await supabaseAdmin.from("fare_observations").insert({
    suspect: check.suspect,
    from_code: input.fromCode,
    to_code: input.toCode,
    cabin: input.cabin,
    price: input.price,
    currency: input.currency,
    airline_iata: input.airlineIata,
    supplier_code: input.supplierCode,
    source: input.source,
    observed_at: input.observedAt,
  });
  if (error) {
    if (error.code === "23505") return { ok: true, duplicate: true };
    console.error("[recordFareObservation] insert failed", error);
    return { ok: false };
  }
  return { ok: true, suspect: check.suspect };
}

/* ------------------------------------------------------------------ */
/* Impossible-fare guard (Phase 3.1, 28 Sep 2026)                       */
/* ------------------------------------------------------------------ */
// A fare below 40% or above 3x the route's usual price is treated as a likely
// data error and held back, the same rule EazAir proved (it caught New York to
// Boston at $919 against a usual $141). A genuine drop such as London's
// $716 -> $545 (0.76x) passes. "Usual" = median of the route's last 20
// NON-suspect readings; with fewer than 3 readings nothing is judged.
export const SUSPECT_LOW_RATIO = 0.4;
export const SUSPECT_HIGH_RATIO = 3;

export async function checkSuspectFare(
  fromCode: string,
  toCode: string,
  cabin: string,
  price: number,
): Promise<{ suspect: boolean; usual: number | null; ratio: number | null; history: number }> {
  const { data, error } = await supabaseAdmin
    .from("fare_observations")
    .select("price")
    .eq("from_code", fromCode)
    .eq("to_code", toCode)
    .eq("cabin", cabin)
    .eq("suspect", false)
    .order("observed_at", { ascending: false })
    .limit(20);
  if (error) {
    // Fail open: a failed read must not block every refresh. Logged so it is visible.
    console.error("[checkSuspectFare] read failed", error);
    return { suspect: false, usual: null, ratio: null, history: 0 };
  }
  const prices = (data ?? []).map((r) => Number(r.price)).filter((n) => n > 0).sort((a, b) => a - b);
  if (prices.length < 3) return { suspect: false, usual: null, ratio: null, history: prices.length };
  const mid = Math.floor(prices.length / 2);
  const usual = prices.length % 2 ? prices[mid]! : (prices[mid - 1]! + prices[mid]!) / 2;
  const ratio = price / usual;
  return { suspect: ratio < SUSPECT_LOW_RATIO || ratio > SUSPECT_HIGH_RATIO, usual, ratio, history: prices.length };
}

/* ------------------------------------------------------------------ */
/* Fare movement detection (Phase 6)                                    */
/* ------------------------------------------------------------------ */

export type FareMovement = {
  fromCode: string;
  toCode: string;
  cabin: string;
  /** Real previous observed price and when it was seen. */
  previousPrice: number;
  previousObservedAt: string;
  /** Real latest observed price and when it was seen. */
  latestPrice: number;
  latestObservedAt: string;
  currency: string;
  /** Real difference between two real observations. Not a forecast. */
  changeAmount: number;
  changePercent: number;
  direction: "drop" | "spike" | "flat";
};

/** A movement must clear BOTH thresholds to count, so a $4 wobble on a $600
 * fare is not reported as a "drop" and a large move on a cheap fare is not
 * missed. Tuned deliberately conservatively: a false alert is worse than a
 * missed one, because alerts that cry wolf get ignored. */
const MIN_CHANGE_PERCENT = 8;
const MIN_CHANGE_ABSOLUTE = 25;

/**
 * Compares each route's two most recent REAL observations of the same cabin.
 * Reports nothing for a route with fewer than two observations -- there is
 * no movement to report from a single data point, and inventing one would
 * be exactly the kind of fabricated insight this project avoids.
 *
 * Purely a read: fetches no fares, writes nothing, changes no page.
 */
export async function detectFareMovements(cabin = "economy", limit = 50): Promise<FareMovement[]> {
  const { data, error } = await supabaseAdmin
    .from("fare_observations")
    .select("from_code, to_code, cabin, price, currency, observed_at")
    .eq("cabin", cabin)
    .eq("suspect", false) // Phase 3.1: a held-back reading is never reported as a movement
    .order("observed_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[detectFareMovements] read failed", error);
    return [];
  }

  // Group by route, newest first (the query already ordered them).
  const byRoute = new Map<string, { price: number; currency: string; observed_at: string }[]>();
  for (const r of data ?? []) {
    const key = `${r.from_code}|${r.to_code}`;
    const list = byRoute.get(key) ?? [];
    list.push({ price: Number(r.price), currency: r.currency, observed_at: r.observed_at });
    byRoute.set(key, list);
  }

  const out: FareMovement[] = [];
  for (const [key, obs] of byRoute) {
    if (obs.length < 2) continue; // no real history yet -- report nothing
    const [latest, previous] = obs as [typeof obs[0], typeof obs[0]];
    const changeAmount = latest.price - previous.price;
    const changePercent = previous.price > 0 ? (changeAmount / previous.price) * 100 : 0;
    if (Math.abs(changePercent) < MIN_CHANGE_PERCENT || Math.abs(changeAmount) < MIN_CHANGE_ABSOLUTE) continue;

    const [fromCode, toCode] = key.split("|") as [string, string];
    out.push({
      fromCode,
      toCode,
      cabin,
      previousPrice: previous.price,
      previousObservedAt: previous.observed_at,
      latestPrice: latest.price,
      latestObservedAt: latest.observed_at,
      currency: latest.currency,
      changeAmount: Math.round(changeAmount),
      changePercent: Math.round(changePercent * 10) / 10,
      direction: changeAmount < 0 ? "drop" : "spike",
    });
  }

  return out.sort((a, b) => a.changePercent - b.changePercent).slice(0, limit);
}
