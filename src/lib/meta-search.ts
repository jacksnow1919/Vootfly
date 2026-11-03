/**
 * Meta-search supplier logic for aggregator partners (EazAir).
 *
 * REAL DATA ONLY. Every itinerary returned here comes from a live PKfare
 * search for the exact route, dates and cabin requested (Duffel was removed
 * 2026-09-07 after repeatedly hitting rate_limit_exceeded on this account).
 * If PKfare has nothing (no availability, no credentials, timeout,
 * error), this returns an EMPTY results array -- never an invented fare. EazAir's aggregator is
 * built to handle an empty/slow partner response gracefully (the visitor
 * just doesn't see an VootFly offer for that search); it is not built
 * to handle a real customer clicking through to a fabricated flight.
 *
 * Previous version of this file generated deterministic-but-fake itineraries
 * (invented flight numbers, times, prices in made-up bands) whenever the
 * `deals` table had no match, specifically so the aggregator "never received
 * an empty result set." That was silently live in production. Removed.
 */
import { z } from "zod";
import { SITE_ORIGIN } from "@/lib/site-config";
import { arrivalIso, departureIso } from "@/lib/fare-times";
import type { SupplierFareTerms, SupplierSegment } from "@/lib/supplier-segments";

export const metaSearchSchema = z.object({
  search_id: z.string().min(1).max(120),
  trip_type: z.enum(["round_trip", "one_way"]),
  origin: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "origin must be a 3-letter IATA code")
    .transform((v) => v.toUpperCase()),
  destination: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "destination must be a 3-letter IATA code")
    .transform((v) => v.toUpperCase()),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "departure_date must be YYYY-MM-DD"),
  return_date: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const s = typeof v === "string" ? v.trim() : "";
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    }),
  passengers: z
    .object({
      adults: z.number().int().min(1).max(9).optional(),
      children: z.number().int().min(0).max(9).optional(),
      infants: z.number().int().min(0).max(9).optional(),
    })
    .optional()
    .transform((p) => ({
      adults: p?.adults ?? 1,
      children: p?.children ?? 0,
      infants: p?.infants ?? 0,
    })),
  cabin_class: z
    .enum(["economy", "premium_economy", "business", "first"])
    .optional()
    .transform((v) => v ?? "economy"),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(6)
    .optional()
    .transform((v) => (v ?? "USD").toUpperCase()),
});

export type MetaSearchRequest = z.infer<typeof metaSearchSchema>;

/**
 * Both clocks are airport-local wall times with a nominal "Z" (the fare
 * provider sends local clocks). Read HH:mm as the local time; do not
 * subtract them to get a duration. duration_minutes is the real length.
 */
type Segment = {
  flight_number: string;
  departure_time: string;
  /** null when the provider sent no arrival; never an estimate. */
  arrival_time: string | null;
  duration_minutes: number;
  stops: number;
};

export type MetaSearchResult = {
  itinerary_id: string;
  airline: string;
  airline_code: string;
  outbound_segment: Segment;
  /**
   * The return flight, sent only when the provider returned its details
   * for this fare (Duffel does for round trips). Never invented: when it is
   * missing it is left out, and total_price still covers the round trip.
   */
  return_segment?: Segment;
  /** The cabin the airline actually priced, as the provider reported it. */
  cabin_class?: string;
  /**
   * EazAir partner contract v2: each flight as the supplier sent it. Sent only
   * when every flight of a direction was readable; never filled in.
   */
  itinerary?: {
    outbound?: { segments: SupplierSegment[] };
    inbound?: { segments: SupplierSegment[] };
  };
  /** Contract v2: only the fare terms the supplier stated for this offer. */
  fare?: SupplierFareTerms;
  pricing: {
    total_price: number;
    currency: string;
  };
  deep_link_url: string;
};

/** Base URL for booking deep links -- the exact link a real EazAir visitor is sent to. */
const BOOKING_BASE = `${SITE_ORIGIN}/flight/booking`;

/** How long we'll wait on PKfare before giving up and returning an empty (real, not fake) result. EazAir itself times out partners at 15s. */
const PROVIDER_BUDGET_MS = 11_000;

const CABIN_MAP: Record<
  MetaSearchRequest["cabin_class"],
  "Economy" | "PremiumEconomy" | "Business" | "First"
> = {
  economy: "Economy",
  premium_economy: "PremiumEconomy",
  business: "Business",
  first: "First",
};

export const buildDeepLink = (
  req: MetaSearchRequest,
  perPersonPrice: number,
  airline: string,
  flightNo?: string,
) => {
  // Checkout multiplies the per-person price by the travellers, so the link carries both.
  const party = req.passengers.adults + req.passengers.children + req.passengers.infants;
  const params = new URLSearchParams({
    origin: req.origin,
    destination: req.destination,
    depart: req.departure_date,
    return: req.trip_type === "round_trip" && req.return_date ? req.return_date : "",
    cabin: req.cabin_class,
    price: String(perPersonPrice),
    ...(party > 1 ? { passengers: String(party) } : {}),
    // The airline's name and the real flight number, so checkout shows the
    // flight the traveller picked on EazAir instead of a placeholder.
    airline,
    ...(flightNo ? { flightNo } : {}),
    click_id: req.search_id,
    utm_source: "eazair",
    utm_medium: "meta",
  });
  return `${BOOKING_BASE}?${params.toString()}`;
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        console.error("[meta/search] PKfare lookup failed", err);
        resolve(fallback);
      },
    );
  });
}

/**
 * Live quotes from the active fare provider (Duffel while PKfare is down;
 * see fare-provider.server.ts). No local inventory table, no generator, no
 * invented numbers.
 */
export const resolveResults = async (req: MetaSearchRequest): Promise<MetaSearchResult[]> => {
  const { runPkfareSearch } = await import("@/lib/pkfare.server");
  const cabinClass = CABIN_MAP[req.cabin_class];

  const params = {
    origin: req.origin,
    destination: req.destination,
    departDate: req.departure_date,
    returnDate: req.trip_type === "round_trip" && req.return_date ? req.return_date : undefined,
    adults: req.passengers.adults,
    children: req.passengers.children || undefined,
    infants: req.passengers.infants || undefined,
    cabinClass,
    currency: req.currency,
    solutions: 20,
  } as const;

  const fares = await withTimeout(runPkfareSearch(params), PROVIDER_BUDGET_MS, []);
  const providerTag = "DF";

  if (!fares.length) return [];

  const cheapest = [...fares].sort((a, b) => a.price - b.price).slice(0, 4);

  const results: MetaSearchResult[] = [];
  for (const fare of cheapest) {
    // total_price must be the whole trip for the whole party.
    // - MContent and Duffel price per person: the supplier's whole-party total is used.
    // - PKFARE prices per adult (adult fare plus taxes and fees), with no
    //   child or infant fares read: it is the total only for one traveller,
    //   so for a larger party the fare is not sent, never multiplied.
    const party = req.passengers.adults + req.passengers.children + req.passengers.infants;
    const total =
      fare.supplier === "pkfare"
        ? party === 1
          ? fare.price
          : undefined
        : fare.totalPrice;
    if (total === undefined) continue;
    const departISO = departureIso(fare.departDate, fare.departTime);
    if (!departISO) continue; // no real timestamp to report; skip rather than invent one
    // The real local arrival the provider sent. Adding the duration to the
    // departure clock would ignore the time-zone change (the bug fixed on
    // AS Airspace in Oct 2026), so a missing arrival stays null.
    const arriveISO = fare.arriveDate ? arrivalIso(fare.arriveDate, fare.arriveTime) : null;
    const back = req.trip_type === "round_trip" ? fare.returnFlight : undefined;
    const backDepart = back ? departureIso(back.departDate, back.departTime) : null;
    results.push({
      itinerary_id: `VF-${providerTag}-${fare.id}`,
      airline: fare.airline,
      airline_code: fare.carrierCode,
      outbound_segment: {
        flight_number: fare.flightNo,
        departure_time: departISO,
        arrival_time: arriveISO,
        duration_minutes: fare.durationMinutes,
        stops: fare.stops,
      },
      ...(back && backDepart
        ? {
            return_segment: {
              flight_number: back.flightNo,
              departure_time: backDepart,
              arrival_time: back.arriveDate ? arrivalIso(back.arriveDate, back.arriveTime) : null,
              duration_minutes: back.durationMinutes,
              stops: back.stops,
            },
          }
        : {}),
      ...(fare.cabin ? { cabin_class: fare.cabin.toUpperCase() } : {}),
      ...itineraryFor(fare.segments, back && backDepart ? back.segments : undefined),
      ...(fare.terms ? { fare: fare.terms } : {}),
      pricing: { total_price: total, currency: fare.currency },
      deep_link_url: buildDeepLink(
        req,
        fare.price,
        fare.airline || fare.carrierCode,
        fare.flightNo,
      ),
    });
  }
  return results;
};

/** The contract v2 `itinerary` block, or nothing when no direction has segments. */
export function itineraryFor(
  outbound: SupplierSegment[] | undefined,
  inbound: SupplierSegment[] | undefined,
): Pick<MetaSearchResult, "itinerary"> {
  if (!outbound?.length && !inbound?.length) return {};
  return {
    itinerary: {
      ...(outbound?.length ? { outbound: { segments: outbound } } : {}),
      ...(inbound?.length ? { inbound: { segments: inbound } } : {}),
    },
  };
}

export const buildMetaSearchResponse = async (req: MetaSearchRequest) => ({
  search_id: req.search_id,
  partner_id: "vootfly",
  timestamp: new Date().toISOString(),
  results: await resolveResults(req),
});
