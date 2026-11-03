/**
 * AEO ("answer engine optimization") direct-answer text for route pages.
 *
 * Search and AI-assistant answer boxes reward a short, extractable, factual
 * answer near the top of a page -- e.g. "The cheapest month to fly NYC to
 * London is...". This module builds that sentence from data the page
 * already has (the n8n fare-refresh snapshot); it never invents numbers.
 * If there's no real fare snapshot yet, callers should render nothing
 * rather than a hedged, made-up answer.
 *
 * See docs/VOOTFLY-STRATEGY.md, section 5.
 */

import { formatMoney, placeLabel, type FareSnapshot, type Place } from "@/lib/hierarchy";
import { airlineName } from "@/lib/airline-names";

/** "2026-10-29T09:32:18Z" -> "Oct 29, 2026". Falls back to the raw string. */
function formatCheckDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type RouteAnswer = {
  /** Single-sentence, extractable direct answer. Always present when this type exists. */
  headline: string;
  /** Optional second sentence with supporting detail (e.g. cheapest month). */
  detail?: string;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-11" -> "November 2026". Falls back to the raw string if it doesn't parse. */
function formatMonthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return month;
  const idx = Number(m[2]) - 1;
  const name = MONTH_NAMES[idx];
  return name ? `${name} ${m[1]}` : month;
}

/**
 * Returns null when there's no real fare snapshot to answer from -- callers
 * should render nothing in that case, not a generic placeholder sentence.
 */
export function buildRouteAnswer(
  from: Place,
  to: Place,
  snapshot: FareSnapshot | null,
): RouteAnswer | null {
  if (!snapshot?.lowest) return null;

  const fromName = placeLabel(from);
  const toName = placeLabel(to);
  const price = formatMoney(snapshot.lowest.amount, snapshot.lowest.currency);
  const airlineLabel = airlineName(snapshot.lowest.airline ?? snapshot.lowest.airline_code);
  const airline = airlineLabel ? ` on ${airlineLabel}` : "";
  // "we found" + the check date, not "currently available": a stored
  // snapshot is a dated search result, not live inventory (29 Oct 2026).
  const checked = snapshot.fetched_at ? ` (checked ${formatCheckDate(snapshot.fetched_at)})` : "";
  const headline = `The lowest fare we found from ${fromName} to ${toName} is ${price}${airline}${checked}.`;

  let detail: string | undefined;
  if (snapshot.by_month?.length) {
    const lowest = [...snapshot.by_month].sort((a, b) => a.lowest - b.lowest)[0];
    if (lowest) {
      // One search per month is not a seasonal pattern, so no "typically".
      detail = `Of the months we checked, ${formatMonthLabel(lowest.month)} had the lowest fare, from ${formatMoney(lowest.lowest, lowest.currency)}.`;
    }
  }

  return detail ? { headline, detail } : { headline };
}
