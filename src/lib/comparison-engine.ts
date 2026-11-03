/**
 * Comparison Engine — Phase 2.
 *
 * A pure, standalone normalization/comparison layer over fares already
 * fetched from PKFARE (PkfareNormalisedFare[], from flightSearch.ts /
 * pkfare.server.ts — neither of which this file imports from or modifies).
 * Nothing here calls PKFARE itself; it operates only on real fares a
 * caller already has in hand.
 *
 * Not wired into the results UI in this phase (flight.search.tsx is
 * explicitly protected). This is the tested, working foundation --
 * deciding how/where to surface it in the UI is a deliberate later choice,
 * not made here.
 *
 * Baggage and fare-condition data are NOT reliably present in PKFARE's
 * response (confirmed during an earlier audit: PKFARE does not supply
 * exact bag counts/weights). Every comparison below treats that as
 * genuinely unknown -- never estimated, defaulted to a number, or implied
 * as "probably included/excluded." A field is either real or explicitly
 * marked unknown; there is no third option.
 */
import type { PkfareNormalisedFare } from "@/lib/pkfare-types";

/** One fare's position in a comparison, with only real, present data. */
export interface ComparedFare {
  id: string;
  airline: string;
  price: number;
  currency: string;
  durationMinutes: number;
  stops: number;
  departMinutes: number;
  arriveMinutes: number;
  refundable: boolean;
  /** Never fabricated -- PKFARE does not reliably supply this, so it is
   * always "unknown" today. Typed as a real field (not just omitted) so a
   * future supplier that DOES provide it has somewhere real to put it. */
  baggage: "unknown";
  /** Same reasoning as baggage. */
  fareConditions: "unknown";
  rank: {
    byPrice: number;
    byDuration: number;
    byStops: number;
  };
  /** True only for the single fare that is best (or tied-best) on price,
   * duration, AND stops simultaneously -- not a weighted/invented score. */
  isBestOverall: boolean;
}

export interface ComparisonResult {
  fares: ComparedFare[];
  /** Real summary values pulled from the input, never computed from an
   * assumption -- e.g. cheapest/fastest reference the actual fares present. */
  cheapestId: string | null;
  fastestId: string | null;
  fewestStopsId: string | null;
  /** How many fares had no usable price/duration and were excluded from
   * ranking (kept out rather than ranked with an invented placeholder). */
  excludedCount: number;
}

function rankBy<T>(items: T[], keyOf: (item: T) => number): Map<T, number> {
  const sorted = [...items].sort((a, b) => keyOf(a) - keyOf(b));
  const ranks = new Map<T, number>();
  let rank = 0;
  let lastKey: number | null = null;
  for (const item of sorted) {
    const key = keyOf(item);
    if (lastKey === null || key > lastKey) rank += 1;
    ranks.set(item, rank);
    lastKey = key;
  }
  return ranks;
}

/**
 * Normalizes and ranks a set of real fares for the SAME search (same
 * route/date/cabin) by price, duration, and stops. Never invents a
 * missing value: a fare with no usable price or duration is excluded from
 * ranking (counted in excludedCount) rather than assigned a fabricated
 * number that would distort the comparison.
 */
export function compareFares(fares: PkfareNormalisedFare[]): ComparisonResult {
  const usable = fares.filter(
    (f) => Number.isFinite(f.price) && f.price > 0 && Number.isFinite(f.durationMinutes) && f.durationMinutes > 0,
  );
  const excludedCount = fares.length - usable.length;

  const priceRanks = rankBy(usable, (f) => f.price);
  const durationRanks = rankBy(usable, (f) => f.durationMinutes);
  const stopsRanks = rankBy(usable, (f) => f.stops);

  const compared: ComparedFare[] = usable.map((f) => {
    const byPrice = priceRanks.get(f)!;
    const byDuration = durationRanks.get(f)!;
    const byStops = stopsRanks.get(f)!;
    return {
      id: f.id,
      airline: f.airline,
      price: f.price,
      currency: f.currency,
      durationMinutes: f.durationMinutes,
      stops: f.stops,
      departMinutes: f.departMinutes,
      arriveMinutes: f.arriveMinutes,
      refundable: f.refundable,
      baggage: "unknown",
      fareConditions: "unknown",
      rank: { byPrice, byDuration, byStops },
      isBestOverall: byPrice === 1 && byDuration === 1 && byStops === 1,
    };
  });

  const cheapest = compared.find((f) => f.rank.byPrice === 1) ?? null;
  const fastest = compared.find((f) => f.rank.byDuration === 1) ?? null;
  const fewestStops = compared.find((f) => f.rank.byStops === 1) ?? null;

  return {
    fares: compared,
    cheapestId: cheapest?.id ?? null,
    fastestId: fastest?.id ?? null,
    fewestStopsId: fewestStops?.id ?? null,
    excludedCount,
  };
}

/**
 * True-cost note for a pair of fares -- deliberately does NOT compute a
 * number, since a genuine baggage-inclusive comparison (like the target
 * architecture's "Comparison Engine" example: airline A at a higher fare
 * that already includes a bag vs airline B's lower fare plus a bag fee)
 * requires real baggage-fee data this phase does not have. Returns an
 * honest explanation instead of an invented adjusted price.
 */
export function trueCostNote(_a: ComparedFare, _b: ComparedFare): string {
  return "Baggage-inclusive true-cost comparison requires real per-airline baggage fee data, which is not available from the current fare source. Comparing listed price only.";
}
