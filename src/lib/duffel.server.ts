/**
 * Duffel Flights API (v2) — SERVER ONLY. Restored 31 Oct 2026 while PKFARE is
 * down (see fare-provider.server.ts); first added 4 Sep, removed 8 Sep 2026.
 *
 * The key never reaches the browser. Duffel's offers are normalised into the
 * same PkfareNormalisedFare shape the rest of the site already uses (including
 * arrival date and the return leg), so no page needs to change.
 * Docs: https://duffel.com/docs/api/offer-requests
 *
 * Integrity: a Duffel TEST key (duffel_test_...) returns sample flights from a
 * fictional airline. Those must never be shown as real fares, so a test key is
 * refused with a clear error instead of being used.
 */
import type { PkfareNormalisedFare, PkfareSearchQuery } from "./pkfare-types";
import { allSegments, localStamp, segment, terms } from "./supplier-segments";
import { duffelTestKeyAllowed, duffelToken } from "./fare-provider.server";

const BASE_URL = "https://api.duffel.com";
const REQUEST_TIMEOUT_MS = 30_000;

type DuffelCabin = "economy" | "premium_economy" | "business" | "first";
const CABIN_MAP: Record<string, DuffelCabin> = {
  Economy: "economy",
  PremiumEconomy: "premium_economy",
  Business: "business",
  First: "first",
};

type DuffelPlace = { iata_code?: string | null };
type DuffelCarrier = { name?: string | null; iata_code?: string | null };
type DuffelSegment = {
  origin?: DuffelPlace;
  destination?: DuffelPlace;
  departing_at?: string;
  arriving_at?: string;
  duration?: string | null;
  marketing_carrier?: DuffelCarrier;
  operating_carrier?: DuffelCarrier;
  marketing_carrier_flight_number?: string | null;
  aircraft?: { name?: string | null } | null;
  passengers?: {
    cabin_class?: string | null;
    cabin_class_marketing_name?: string | null;
    baggages?: { type?: string | null; quantity?: number | null }[] | null;
  }[];
};
type DuffelSlice = { duration?: string | null; segments?: DuffelSegment[]; fare_brand_name?: string | null };
type DuffelOffer = {
  id: string;
  total_amount?: string;
  total_currency?: string;
  slices?: DuffelSlice[];
  owner?: DuffelCarrier;
  conditions?: {
    refund_before_departure?: DuffelCondition | null;
    change_before_departure?: DuffelCondition | null;
  } | null;
  passengers?: { id?: string; type?: string | null }[];
  base_amount?: string | null;
  base_currency?: string | null;
  tax_amount?: string | null;
  tax_currency?: string | null;
  expires_at?: string | null;
  passenger_identity_documents_required?: boolean | null;
};
type DuffelCondition = { allowed?: boolean | null; penalty_amount?: string | null; penalty_currency?: string | null };
type DuffelOfferRequestResponse = {
  data?: { id: string; offers?: DuffelOffer[] };
  errors?: { title?: string; message?: string; code?: string }[];
};

function credentials(): string {
  const token = duffelToken();
  if (!token) throw new Error("Duffel credentials are not configured");
  if (token.startsWith("duffel_test_") && !duffelTestKeyAllowed()) {
    throw new Error("The Duffel key is a test key, which only returns sample flights. A live key (duffel_live_...) is needed for real fares.");
  }
  return token;
}

/** "PT7H30M" or "P1DT2H" -> minutes. 0 when unparsable. */
function isoDurationToMinutes(iso?: string | null): number {
  if (!iso) return 0;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(iso);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0);
}

/** Duffel times are local to the airport ("2026-11-05T19:30:00"); read them as written. */
function localClock(iso?: string): { label: string; minutes: number; date: string } {
  const m = iso ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso) : null;
  if (!m) return { label: "", minutes: 0, date: "" };
  const h = Number(m[2]);
  const min = Number(m[3]);
  const label = `${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return { label, minutes: h * 60 + min, date: m[1]! };
}

function fmtDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function sliceInfo(slice: DuffelSlice | undefined) {
  const segments = slice?.segments ?? [];
  if (segments.length === 0) return null;
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  let maxLayover = 0;
  let layoverTotal = 0;
  for (let i = 1; i < segments.length; i++) {
    const a = segments[i - 1]!.arriving_at ? Date.parse(segments[i - 1]!.arriving_at! + "Z") : NaN;
    const d = segments[i]!.departing_at ? Date.parse(segments[i]!.departing_at! + "Z") : NaN;
    // Both times are local to the same connecting airport, so their difference is real.
    if (Number.isFinite(a) && Number.isFinite(d) && d > a) {
      const mins = Math.round((d - a) / 60000);
      maxLayover = Math.max(maxLayover, mins);
      layoverTotal += mins;
    }
  }
  const segmentMinutes = segments.reduce((s, seg) => s + isoDurationToMinutes(seg.duration), 0);
  const durationMinutes = isoDurationToMinutes(slice?.duration) || segmentMinutes + layoverTotal;
  const dep = localClock(first.departing_at);
  const arr = localClock(last.arriving_at);
  const carrier = first.marketing_carrier ?? {};
  const code = (carrier.iata_code ?? "").toUpperCase().slice(0, 2);
  return {
    first,
    segments,
    detail: allSegments(
      segments.map((seg) =>
        segment({
          carrier: seg.marketing_carrier?.iata_code,
          carrierName: seg.marketing_carrier?.name,
          operatingCarrier: seg.operating_carrier?.iata_code,
          flightNumber: seg.marketing_carrier_flight_number,
          origin: seg.origin?.iata_code,
          destination: seg.destination?.iata_code,
          departure: localStamp(seg.departing_at),
          arrival: localStamp(seg.arriving_at),
          aircraft: seg.aircraft?.name,
        }),
      ),
    ),
    airline: carrier.name ?? "",
    carrierCode: code,
    flightNo: `${code} ${first.marketing_carrier_flight_number ?? ""}`.trim(),
    origin: first.origin?.iata_code ?? "",
    destination: last.destination?.iata_code ?? "",
    departDate: dep.date,
    arriveDate: arr.date || dep.date,
    departTime: dep.label,
    arriveTime: arr.label,
    departMinutes: dep.minutes,
    arriveMinutes: arr.minutes,
    durationMinutes,
    maxLayover,
    stops: Math.max(0, segments.length - 1),
  };
}

function normaliseOffer(offer: DuffelOffer, requestedCabin: string): PkfareNormalisedFare | null {
  const out = sliceInfo(offer.slices?.[0]);
  if (!out) return null;
  // total_amount covers the whole party, but the site labels and books prices per person,
  // so a party of two used to show their total as "per person" and be doubled at checkout
  // (found 3 Nov 2026: $300 for one traveller, $599 "per person" for two).
  const total = Number(offer.total_amount ?? "0");
  const price = total / Math.max(1, offer.passengers?.length ?? 1);
  if (!Number.isFinite(price) || price <= 0) return null;

  // The cabin the AIRLINE actually priced (from Duffel's per-segment passenger
  // data), not just the one we asked for, so "economy" is supplier-confirmed.
  const supplierCabin = out.first.passengers?.[0]?.cabin_class;
  const cabin = supplierCabin ? supplierCabin.toUpperCase() : requestedCabin;

  const ret = sliceInfo(offer.slices?.[1]);
  const airline = offer.owner?.name || out.airline || "Airline";
  // Only what Duffel stated for this offer. A brand is sent only when every
  // slice names the same one.
  const brands = new Set((offer.slices ?? []).map((sl) => sl.fare_brand_name?.trim() || ""));
  const offerTerms = terms({
    brand: brands.size === 1 ? [...brands][0] : undefined,
    baggage: duffelBags(offer),
    changeable: offer.conditions?.change_before_departure?.allowed ?? undefined,
    refundable: offer.conditions?.refund_before_departure?.allowed ?? undefined,
  });
  const carrierCode = (offer.owner?.iata_code || out.carrierCode || "").toUpperCase().slice(0, 2);

  return {
    id: offer.id,
    airline,
    carrierCode,
    flightNo: out.flightNo,
    origin: out.origin,
    destination: out.destination,
    departDate: out.departDate,
    arriveDate: out.arriveDate,
    departTime: out.departTime,
    arriveTime: out.arriveTime,
    duration: fmtDuration(out.durationMinutes),
    durationMinutes: out.durationMinutes,
    departMinutes: out.departMinutes,
    arriveMinutes: out.arriveMinutes,
    maxLayoverMinutes: out.maxLayover,
    cabin,
    currency: (offer.total_currency || "USD").toUpperCase(),
    price: Math.round(price),
    totalPrice: Math.round(total),
    refundable: offer.conditions?.refund_before_departure?.allowed === true,
    ...(ret
      ? {
          returnFlight: {
            airline: ret.airline || airline,
            flightNo: ret.flightNo,
            origin: ret.origin,
            destination: ret.destination,
            departDate: ret.departDate,
            arriveDate: ret.arriveDate,
            departTime: ret.departTime,
            arriveTime: ret.arriveTime,
            duration: fmtDuration(ret.durationMinutes),
            durationMinutes: ret.durationMinutes,
            stops: ret.stops,
            ...(ret.detail ? { segments: ret.detail } : {}),
          },
        }
      : {}),
    stops: out.stops,
    ...(out.detail ? { segments: out.detail } : {}),
    ...(offerTerms ? { terms: offerTerms } : {}),
  };
}

/**
 * The first traveller's bag allowance when every flight of the offer states
 * the same one; otherwise nothing, so a bag is never promised on one flight
 * because another flight includes it.
 */
function duffelBags(offer: DuffelOffer): { cabin_bags?: number; checked_bags?: number } {
  const per = (kind: string): number | undefined => {
    const counts = new Set<number>();
    for (const slice of offer.slices ?? []) {
      for (const seg of slice.segments ?? []) {
        const bags = seg.passengers?.[0]?.baggages;
        if (!bags) return undefined;
        counts.add(bags.filter((b) => b.type === kind).reduce((n, b) => n + (b.quantity ?? 0), 0));
      }
    }
    return counts.size === 1 ? [...counts][0] : undefined;
  };
  const cabin = per("carry_on");
  const checked = per("checked");
  return {
    ...(cabin !== undefined ? { cabin_bags: cabin } : {}),
    ...(checked !== undefined ? { checked_bags: checked } : {}),
  };
}

export async function runDuffelSearch(query: PkfareSearchQuery): Promise<PkfareNormalisedFare[]> {
  const token = credentials();
  const cabinLabel = query.cabinClass ?? "Economy";
  const cabin_class = CABIN_MAP[cabinLabel] ?? "economy";

  const passengers = [
    ...Array.from({ length: Math.max(1, query.adults ?? 1) }, () => ({ type: "adult" as const })),
    ...Array.from({ length: Math.max(0, query.children ?? 0) }, () => ({ age: 8 })),
    ...Array.from({ length: Math.max(0, query.infants ?? 0) }, () => ({ age: 1 })),
  ];
  const slices = [
    { origin: query.origin, destination: query.destination, departure_date: query.departDate },
    ...(query.returnDate ? [{ origin: query.destination, destination: query.origin, departure_date: query.returnDate }] : []),
  ];

  console.info("[Duffel] offer request", slices.map((s) => `${s.origin}-${s.destination}@${s.departure_date}`).join(" | "), `cabin=${cabin_class} pax=${passengers.length}`);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/air/offer_requests?return_offers=true&supplier_timeout=15000`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Duffel-Version": "v2",
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { slices, passengers, cabin_class, max_connections: 1 } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[Duffel] transport failure", error);
    throw new Error("We couldn't reach the flight provider just now. Please try again in a moment.");
  }

  let body: DuffelOfferRequestResponse;
  try {
    body = (await res.json()) as DuffelOfferRequestResponse;
  } catch (error) {
    console.error("[Duffel] unreadable response", error);
    throw new Error("We couldn't read the flight provider's response. Please try again.");
  }

  if (!res.ok || body.errors?.length) {
    const first = body.errors?.[0];
    const detail = first ? `${first.code ?? res.status}: ${first.title ?? first.message ?? "unknown error"}` : String(res.status);
    console.error(`[Duffel] air/offer_requests failed (${detail})`);
    throw new Error(`The flight provider couldn't complete that search (${detail}).`);
  }

  let fares = (body.data?.offers ?? [])
    .map((offer) => normaliseOffer(offer, cabinLabel))
    .filter((f): f is PkfareNormalisedFare => f !== null);

  // Optional carrier hint (PKFARE accepted one natively; Duffel has no such filter).
  if (query.airline) {
    const hint = query.airline.toUpperCase();
    const matching = fares.filter((f) => f.carrierCode === hint);
    if (matching.length) fares = matching;
  }
  fares.sort((a, b) => a.price - b.price);
  const limit = query.solutions && query.solutions > 0 ? query.solutions : 50;
  fares = fares.slice(0, Math.max(limit, 1));
  console.info(`[Duffel] ${body.data?.offers?.length ?? 0} offers -> ${fares.length} fares`);
  return fares;
}

/* ------------------------------------------------------------------ */
/* Booking (3 Nov 2026): re-read one offer, then turn it into an order */
/* ------------------------------------------------------------------ */

export type TripSegment = {
  carrier: string;
  flightNo: string;
  origin: string;
  destination: string;
  departAt: string;
  arriveAt: string;
};
export type TripSlice = {
  origin: string;
  destination: string;
  departAt: string;
  arriveAt: string;
  duration: string;
  stops: number;
  cabin: string | null;
  segments: TripSegment[];
};
export type TripCondition = { allowed: boolean | null; penalty: string | null };
/** What the airline's offer states about the trip. Anything it leaves out stays null, never guessed. */
export type TripSnapshot = {
  airline: string;
  slices: TripSlice[];
  cabinBags: number | null;
  checkedBags: number | null;
  refund: TripCondition;
  change: TripCondition;
};
export type DuffelQuote = {
  offerId: string;
  total: string;
  currency: string;
  /** Only when the offer states them in the same currency as the total. */
  base: string | null;
  tax: string | null;
  passengerIds: string[];
  identityDocumentsRequired: boolean;
  trip: TripSnapshot;
};
export type DuffelQuoteResult =
  | { ok: true; quote: DuffelQuote }
  | { ok: false; reason: "unavailable" | "check_failed" };

const ORDER_TIMEOUT_MS = 120_000;

function duffelHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Duffel-Version": "v2",
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "Content-Type": "application/json",
  };
}

function condition(c: DuffelCondition | null | undefined): TripCondition {
  const allowed = typeof c?.allowed === "boolean" ? c.allowed : null;
  const penalty = c?.penalty_amount && c.penalty_currency ? `${c.penalty_currency} ${c.penalty_amount}` : null;
  return { allowed, penalty };
}

function tripFromOffer(offer: DuffelOffer): TripSnapshot {
  const bags = duffelBags(offer);
  const slices = (offer.slices ?? []).flatMap((slice): TripSlice[] => {
    const info = sliceInfo(slice);
    if (!info) return [];
    const last = info.segments[info.segments.length - 1]!;
    return [
      {
        origin: info.origin,
        destination: info.destination,
        departAt: info.first.departing_at ?? "",
        arriveAt: last.arriving_at ?? "",
        duration: fmtDuration(info.durationMinutes),
        stops: info.stops,
        cabin: info.first.passengers?.[0]?.cabin_class_marketing_name ?? info.first.passengers?.[0]?.cabin_class ?? null,
        segments: info.segments.map((seg) => ({
          carrier: seg.marketing_carrier?.name ?? "",
          flightNo: `${seg.marketing_carrier?.iata_code ?? ""} ${seg.marketing_carrier_flight_number ?? ""}`.trim(),
          origin: seg.origin?.iata_code ?? "",
          destination: seg.destination?.iata_code ?? "",
          departAt: seg.departing_at ?? "",
          arriveAt: seg.arriving_at ?? "",
        })),
      },
    ];
  });
  return {
    airline: offer.owner?.name ?? slices[0]?.segments[0]?.carrier ?? "Airline",
    slices,
    cabinBags: bags.cabin_bags ?? null,
    checkedBags: bags.checked_bags ?? null,
    refund: condition(offer.conditions?.refund_before_departure),
    change: condition(offer.conditions?.change_before_departure),
  };
}

/**
 * The exact offer the customer selected, freshly read from Duffel. This is the only source
 * of the amount the customer pays; nothing the browser sends can change it.
 */
export async function getDuffelOffer(offerId: string): Promise<DuffelQuoteResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/air/offers/${encodeURIComponent(offerId)}`, {
      headers: duffelHeaders(credentials()),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[Duffel] offer read failed", error);
    return { ok: false, reason: "check_failed" };
  }
  const body = (await res.json().catch(() => null)) as { data?: DuffelOffer; errors?: { code?: string; title?: string }[] } | null;
  if (!res.ok || !body?.data) {
    const first = body?.errors?.[0];
    console.error(`[Duffel] air/offers failed (${first?.code ?? res.status}: ${first?.title ?? "unknown"})`);
    // 4xx means Duffel answered and the offer can no longer be booked; anything else is an unknown.
    return { ok: false, reason: res.status >= 400 && res.status < 500 ? "unavailable" : "check_failed" };
  }

  const offer = body.data;
  const total = offer.total_amount;
  const currency = (offer.total_currency ?? "").toUpperCase();
  const passengerIds = (offer.passengers ?? []).map((p) => p.id ?? "").filter(Boolean);
  const expired = offer.expires_at ? Date.parse(offer.expires_at) <= Date.now() : false;
  if (!total || !currency || passengerIds.length === 0 || expired) return { ok: false, reason: "unavailable" };

  const sameCurrency = (c?: string | null) => (c ?? "").toUpperCase() === currency;
  return {
    ok: true,
    quote: {
      offerId: offer.id,
      total,
      currency,
      base: offer.base_amount && sameCurrency(offer.base_currency) ? offer.base_amount : null,
      tax: offer.tax_amount && sameCurrency(offer.tax_currency) ? offer.tax_amount : null,
      passengerIds,
      identityDocumentsRequired: offer.passenger_identity_documents_required === true,
      trip: tripFromOffer(offer),
    },
  };
}

export type DuffelOrderPassenger = {
  id: string;
  title: string;
  gender: "m" | "f";
  given_name: string;
  family_name: string;
  born_on: string;
  email: string;
  phone_number: string;
  identity_documents?: { type: "passport"; unique_identifier: string; issuing_country_code: string; expires_on: string }[];
};

export type DuffelOrderResult =
  | { ok: true; orderId: string; bookingReference: string; ticketNumbers: string[] }
  /** Duffel answered and refused, so no order exists and the card hold can be released. */
  | { ok: false; outcome: "refused"; code: string; message: string }
  /** No clear answer (timeout, 5xx). An order may exist, so nothing may be released automatically. */
  | { ok: false; outcome: "unknown"; code: string; message: string };

/**
 * Books the offer and pays the airline from the prefunded Duffel Balance. Call this only
 * after the customer's card hold has been verified with Stripe on the server.
 */
export async function createDuffelOrder(input: {
  offerId: string;
  amount: string;
  currency: string;
  passengers: DuffelOrderPassenger[];
  checkoutId: string;
}): Promise<DuffelOrderResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/air/orders`, {
      method: "POST",
      headers: duffelHeaders(credentials()),
      body: JSON.stringify({
        data: {
          type: "instant",
          selected_offers: [input.offerId],
          passengers: input.passengers,
          payments: [{ type: "balance", amount: input.amount, currency: input.currency }],
          metadata: { checkout_id: input.checkoutId },
        },
      }),
      signal: AbortSignal.timeout(ORDER_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[Duffel] order transport failure", error);
    return { ok: false, outcome: "unknown", code: "order_no_response", message: String(error) };
  }

  const body = (await res.json().catch(() => null)) as {
    data?: { id?: string; booking_reference?: string | null; documents?: { unique_identifier?: string }[] };
    errors?: { code?: string; title?: string; message?: string }[];
  } | null;

  if (!res.ok) {
    const first = body?.errors?.[0];
    const code = first?.code ?? `http_${res.status}`;
    const message = first?.message ?? first?.title ?? `Duffel returned ${res.status}`;
    console.error(`[Duffel] air/orders failed (${code}): ${message}`);
    return { ok: false, outcome: res.status >= 400 && res.status < 500 ? "refused" : "unknown", code, message };
  }

  const orderId = body?.data?.id;
  const bookingReference = body?.data?.booking_reference;
  if (!orderId || !bookingReference) {
    // A success without an airline reference is not a confirmation, and one is never made up.
    console.error("[Duffel] order accepted without a booking reference", orderId);
    return { ok: false, outcome: "unknown", code: "order_without_reference", message: `Order ${orderId ?? "(no id)"} has no airline reference` };
  }
  const ticketNumbers = (body?.data?.documents ?? []).map((d) => d.unique_identifier ?? "").filter(Boolean);
  return { ok: true, orderId, bookingReference, ticketNumbers };
}
