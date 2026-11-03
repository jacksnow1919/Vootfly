import { useQueries } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { Link } from "@tanstack/react-router";
import { lowestFareForDate } from "@/services/flightSearch";
import type { PkfareSearchQuery } from "@/lib/pkfare-types";
import type { SearchParams } from "@/routes/flight.search";

type Props = {
  origin: string;
  destination: string;
  date: string;
  passengers: number;
  cabin: PkfareSearchQuery["cabinClass"];
  currency: string;
};

/**
 * +/-3 day fare comparison strip (SEO strategy quick-win #2). Each day is a
 * lightweight lowest-fare-only lookup (see lowestFareForDate), not a full
 * search, so this stays cheap even once a real per-call-billed provider is
 * connected. Only ever rendered on /flight/search, hence the hardcoded `from`.
 */
export function FlexibleDateStrip({ origin, destination, date, passengers, cabin, currency }: Props) {
  const centerDate = parseISO(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(centerDate, i - 3));

  const results = useQueries({
    queries: days.map((d) => {
      const iso = format(d, "yyyy-MM-dd");
      return {
        queryKey: ["flexible-date-price", origin, destination, iso, cabin, currency],
        queryFn: () =>
          lowestFareForDate({
            origin,
            destination,
            departDate: iso,
            adults: passengers,
            cabinClass: cabin,
            currency,
          }),
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  const prices = results.map((r) => r.data);
  const lowest = Math.min(...prices.filter((p): p is number => typeof p === "number" && p > 0));
  // Mark only the first date that hits the lowest price. Real fares can
  // genuinely tie across nearby dates, but showing "Cheapest" on 2-3 cards
  // at once reads as a bug regardless of whether the underlying prices are
  // real -- one clear answer is better UX than an accurate-but-confusing tie.
  const cheapestIndex = prices.findIndex((p) => typeof p === "number" && p === lowest && p > 0);

  return (
    <div className="mb-4 overflow-x-auto rounded-xl border border-border bg-card">
      <div className="flex min-w-max divide-x divide-border">
        {days.map((d, i) => {
          const iso = format(d, "yyyy-MM-dd");
          const isSelected = iso === date;
          const price = results[i]?.data;
          const isLoading = results[i]?.isPending;
          const isCheapest = i === cheapestIndex;
          return (
            <Link
              key={iso}
              from="/flight/search"
              to="."
              search={(prev: SearchParams) => ({ ...prev, date: iso })}
              className={`flex min-w-[92px] flex-1 flex-col items-center gap-0.5 px-3 py-2.5 text-center transition ${
                isSelected ? "bg-primary/10" : "hover:bg-secondary/60"
              }`}
            >
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                {format(d, "EEE d MMM")}
              </span>
              <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-navy"}`}>
                {isLoading ? "…" : price ? `$${price.toLocaleString()}` : "—"}
              </span>
              {isCheapest && !isSelected ? (
                <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Cheapest</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
