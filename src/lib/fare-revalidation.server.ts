/**
 * Fare/Offer Revalidation Foundation — Phase 2.
 *
 * Before a booking request is finalized, re-checks whether the selected
 * fare's price is still genuinely available by running a real, fresh
 * PKFARE search for the same route/date/cabin (via runPkfareSearch,
 * imported and called, never modified) and comparing against what the
 * customer actually saw at search time.
 *
 * PKFARE's Shopping V4 API has no dedicated "revalidate this exact offer
 * ID" endpoint distinct from a fresh search (confirmed by the actual API
 * usage already built in this project) -- so "revalidation" here means a
 * real fresh search compared against the original price, not a lookup of
 * the literal prior offer. That distinction is reflected honestly in the
 * status values below, never presented as a stronger guarantee than it is.
 *
 * NEVER silently changes the price the customer agreed to. This function
 * only reports a status and a real number (or none) -- the caller decides
 * what to store; nothing here mutates a booking's total_price.
 */
import { runPkfareSearch } from "@/lib/pkfare.server";
import type { PkfareSearchQuery } from "@/lib/pkfare-types";

export type RevalidationStatus =
  | "confirmed" // a fresh real search found a fare at or below the original price
  | "price_changed" // a fresh real search found fares, but none at the original price
  | "unavailable" // a fresh real search ran successfully but found nothing at all
  | "check_failed"; // the fresh search itself errored (e.g. provider timeout) -- unknown, not "unavailable"

export type RevalidationResult = {
  status: RevalidationStatus;
  /** The price the customer originally saw and is requesting. */
  originalPrice: number;
  /** The real lowest price found on the fresh check, or null if none/failed. */
  currentPrice: number | null;
  /** currentPrice - originalPrice when both are real numbers, else null. Never estimated. */
  priceDifference: number | null;
  checkedAt: string;
};

export async function revalidateFare(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  /** Re-check with the supplier that quoted the fare (1 Nov 2026). Omit to let the site choose. */
  supplier?: PkfareSearchQuery["supplier"];
  cabinClass?: PkfareSearchQuery["cabinClass"];
  originalPrice: number;
  currency: string;
}): Promise<RevalidationResult> {
  const checkedAt = new Date().toISOString();
  try {
    const fares = await runPkfareSearch({
      origin: input.origin,
      destination: input.destination,
      departDate: input.departDate,
      returnDate: input.returnDate,
      ...(input.supplier ? { supplier: input.supplier } : {}),
      cabinClass: input.cabinClass ?? "Economy",
      currency: input.currency,
      solutions: 20,
    });

    if (fares.length === 0) {
      return { status: "unavailable", originalPrice: input.originalPrice, currentPrice: null, priceDifference: null, checkedAt };
    }

    const currentPrice = Math.min(...fares.map((f) => f.price));
    const status: RevalidationStatus = currentPrice <= input.originalPrice ? "confirmed" : "price_changed";
    return {
      status,
      originalPrice: input.originalPrice,
      currentPrice,
      priceDifference: currentPrice - input.originalPrice,
      checkedAt,
    };
  } catch (e) {
    console.error("[revalidateFare] check failed", e);
    return { status: "check_failed", originalPrice: input.originalPrice, currentPrice: null, priceDifference: null, checkedAt };
  }
}
