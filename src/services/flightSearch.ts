/**
 * Client-side flight search service — provider-agnostic entry point.
 *
 * PKFARE is the sole live provider. There is NO mock/sample/demo fallback
 * anymore: per explicit instruction, this must never show an invented
 * price. If PKFARE returns nothing or errors, callers get an honest empty
 * result with a clear, specific reason -- never a fabricated fare standing
 * in for a real one. (The old fallback generator, mock-fares.ts, and an
 * orphaned duplicate of this whole file, pkfareApi.ts -- unused, never
 * actually imported anywhere -- were both deleted 2026-09-12.)
 */
import { searchPkfare } from "@/lib/pkfare.functions";
import type { PkfareNormalisedFare, PkfareSearchQuery } from "@/lib/pkfare-types";

export type * from "@/lib/pkfare-types";

export type FareSource = "pkfare" | "unavailable";

export type FareSearchResult = {
  fares: PkfareNormalisedFare[];
  /** "pkfare" = real live results (can still be an empty array -- a genuine
   * no-availability search). "unavailable" = no real fares could be shown,
   * for the reason in fallbackReason. Never "mock" -- that source and its
   * generator (mock-fares.ts) were removed entirely, not just deprioritised. */
  source: FareSource;
  /** Set only when source === "unavailable" -- shown to the visitor as the
   * reason, and specific enough to debug from (e.g. distinguishes "the
   * requested date is in the past" from "PKFARE found nothing" from "PKFARE
   * errored"), never a generic catch-all. */
  fallbackReason?: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Mirrors pkfare.server.ts's own dateOutOfProviderRange() so the client can
 * give a specific, honest reason instead of misattributing a date-guard
 * rejection to "PKFARE found nothing" (found 2026-09-12: a past-dated test
 * search was never actually sent to PKFARE at all, but the old message
 * implied it had been and had failed). */
function dateExplanation(date: string): string | null {
  const stamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(stamp)) return `"${date}" isn't a valid date`;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (stamp < today) return `${date} is in the past -- no airline sells tickets for a departed flight`;
  const oneYear = today + 365 * 24 * 60 * 60 * 1000;
  if (stamp > oneYear) return `${date} is more than a year out, and airlines don't sell that far ahead yet`;
  return null;
}

function buildPayload(query: PkfareSearchQuery, solutions: number) {
  return {
    origin: query.origin,
    destination: query.destination,
    departDate: query.departDate,
    ...(query.returnDate ? { returnDate: query.returnDate } : {}),
    adults: query.adults ?? 1,
    children: query.children ?? 0,
    infants: query.infants ?? 0,
    cabinClass: query.cabinClass ?? "Economy",
    currency: query.currency ?? "USD",
    solutions,
    ...(query.airline ? { airline: query.airline } : {}),
  } as const;
}

/**
 * Search live inventory through the secure backend (PKFARE). Never fabricates
 * a fare: an empty/failed real search returns an empty fares array with a
 * specific, honest reason, for the UI to render as "No live fares available"
 * -- not a fallback to sample data.
 */
export async function searchFlightsWithMeta(query: PkfareSearchQuery): Promise<FareSearchResult> {
  const dateIssue = dateExplanation(query.departDate) ?? (query.returnDate ? dateExplanation(query.returnDate) : null);
  if (dateIssue) {
    // Never even reaches PKFARE for a guaranteed-empty date -- say so plainly
    // instead of letting it look like a live-provider failure.
    return { fares: [], source: "unavailable", fallbackReason: dateIssue };
  }

  const payload = buildPayload(query, query.solutions ?? 20);

  try {
    const fares = await searchPkfare({ data: payload });
    if (fares.length > 0) return { fares, source: "pkfare" };
    return { fares: [], source: "unavailable", fallbackReason: "No live fares were found for this route and date" };
  } catch (error) {
    return { fares: [], source: "unavailable", fallbackReason: errorMessage(error) };
  }
}
