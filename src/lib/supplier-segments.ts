/**
 * Flight-by-flight detail and fare terms for the EazAir feed (partner contract v2).
 *
 * Each supplier normaliser builds these from its own raw reply. Nothing is
 * defaulted: a field the supplier did not send is left out, so EazAir shows
 * "confirm on the partner site" instead of a guess. Clocks stay airport-local
 * as the supplier wrote them ("YYYY-MM-DDTHH:mm:00"), never shifted.
 *
 * Contract: https://github.com/adsbymanish/eazair-voyage-finder/blob/main/docs/partner-contract-v2.md
 *
 * Prepared by: Emma Jackob
 */

export interface SupplierSegment {
  /** Marketing carrier code, e.g. "AS". */
  carrier: string;
  carrier_name?: string;
  /** Operating carrier, only when it differs (codeshare). */
  operating_carrier?: string;
  flight_number: string | null;
  origin: string;
  destination: string;
  departure_time: string | null;
  arrival_time: string | null;
  aircraft?: string;
}

/** Only terms the supplier stated for this offer. Bag counts are per traveller. */
export interface SupplierFareTerms {
  brand?: string;
  baggage?: { cabin_bags?: number; checked_bags?: number };
  changeable?: boolean;
  refundable?: boolean;
}

/** "2026-11-14T07:03:00.000+00:00" or ("2026-11-14", "7:03") -> "2026-11-14T07:03:00". */
export function localStamp(value: string | null | undefined, time?: string | null): string | null {
  if (!value) return null;
  if (time !== undefined) {
    const d = /^(\d{4}-\d{2}-\d{2})$/.exec(value.trim());
    const t = time ? /^(\d{1,2}):(\d{2})/.exec(time.trim()) : null;
    return d && t ? `${d[1]}T${t[1]!.padStart(2, "0")}:${t[2]}:00` : null;
  }
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim());
  return m ? `${m[1]}T${m[2]}:${m[3]}:00` : null;
}

const IATA = /^[A-Z0-9]{3}$/;
const CARRIER = /^[A-Z0-9]{2}$/;

/** A segment, or null when it lacks a valid carrier or either airport. */
export function segment(input: {
  carrier: string | null | undefined;
  carrierName?: string | null | undefined;
  operatingCarrier?: string | null | undefined;
  flightNumber?: string | null | undefined;
  origin: string | null | undefined;
  destination: string | null | undefined;
  departure: string | null;
  arrival: string | null;
  aircraft?: string | null | undefined;
}): SupplierSegment | null {
  const carrier = (input.carrier ?? "").trim().toUpperCase();
  const origin = (input.origin ?? "").trim().toUpperCase();
  const destination = (input.destination ?? "").trim().toUpperCase();
  if (!CARRIER.test(carrier) || !IATA.test(origin) || !IATA.test(destination)) return null;
  const operating = (input.operatingCarrier ?? "").trim().toUpperCase();
  const number = (input.flightNumber ?? "").trim();
  const name = input.carrierName?.trim();
  const aircraft = input.aircraft?.trim();
  return {
    carrier,
    ...(name ? { carrier_name: name } : {}),
    ...(CARRIER.test(operating) && operating !== carrier ? { operating_carrier: operating } : {}),
    // "562" -> "AS 562"; "AS562" or "AS 562" kept as sent.
    flight_number: number ? (/^\d+[A-Z]?$/i.test(number) ? `${carrier} ${number}` : number) : null,
    origin,
    destination,
    departure_time: input.departure,
    arrival_time: input.arrival,
    ...(aircraft ? { aircraft } : {}),
  };
}

/** All of a leg's segments, or undefined if any one is unusable: never half an itinerary. */
export function allSegments(list: (SupplierSegment | null)[]): SupplierSegment[] | undefined {
  if (list.length === 0 || list.some((s) => s === null)) return undefined;
  return list as SupplierSegment[];
}

/** What a normaliser read from its supplier, possibly unknown per field. */
export type SupplierFareTermsInput = {
  brand?: string | undefined;
  baggage?: { cabin_bags?: number | undefined; checked_bags?: number | undefined } | undefined;
  changeable?: boolean | undefined;
  refundable?: boolean | undefined;
};

/** Drops empty terms, so an offer with nothing stated sends no `fare` block. */
export function terms(t: SupplierFareTermsInput): SupplierFareTerms | undefined {
  const out: SupplierFareTerms = {};
  if (t.brand?.trim()) out.brand = t.brand.trim();
  const bags = t.baggage ?? {};
  const baggage: NonNullable<SupplierFareTerms["baggage"]> = {};
  if (typeof bags.cabin_bags === "number" && Number.isInteger(bags.cabin_bags))
    baggage.cabin_bags = bags.cabin_bags;
  if (typeof bags.checked_bags === "number" && Number.isInteger(bags.checked_bags))
    baggage.checked_bags = bags.checked_bags;
  if (Object.keys(baggage).length) out.baggage = baggage;
  if (typeof t.changeable === "boolean") out.changeable = t.changeable;
  if (typeof t.refundable === "boolean") out.refundable = t.refundable;
  return Object.keys(out).length ? out : undefined;
}
