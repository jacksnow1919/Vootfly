/**
 * MContent flight search — SERVER ONLY (added 1 Nov 2026).
 *
 * A second live fare supplier alongside Duffel (see fare-provider.server.ts). The owner
 * supplied the request format; it was confirmed against the live API on 1 Nov 2026:
 *
 *   GET https://api.mcontent.site/api/Soulservices
 *     ?currency=USD&origin=JFK&destination=LAX
 *     &departureDate=10-12-2026            (dd-MM-yyyy)
 *     &returnDate=17-12-2026               (round trips only, with JourneyType=R)
 *     &JourneyType=O|R&airlines=&cabin=Y
 *     &adults=1&children=0&infants=0
 *     &siteid=<MContent_ID>&source=<MContent_Source>
 *
 * Reply: { Count, Data: [ { TotalPrice, Currency, Carrier, UniqueId,
 *   AdultPrice: { Price, BaseFare, Tax, NoPax },
 *   OutBound: { Sector: [...], Stops, TotalTime }, InBound: { Sector: [...] } } ] }
 * Each Sector has DepAirportCode, ArrAirportCode, DepDateTime, ArrDateTime (local clock
 * times written with a +00:00 suffix, so they are read as written, never shifted),
 * ElapsedTime "hh:mm", FlightNo, MCarrier, CabinName.
 *
 * Results are normalised into the same PkfareNormalisedFare shape as Duffel and PKFARE,
 * tagged supplier "mcontent". The credentials stay on the server (project secrets
 * MContent_ID and MContent_Source) and never reach the browser.
 */
import type { PkfareNormalisedFare, PkfareSearchQuery } from "./pkfare-types";
import { mcontentCredentials } from "./fare-provider.server";
import { allSegments, localStamp, segment } from "./supplier-segments";

const BASE_URL = (process.env["MCONTENT_BASE_URL"] || "https://api.mcontent.site/api").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 30_000;

const CABIN_CODE: Record<string, string> = { Economy: "Y", PremiumEconomy: "W", Business: "C", First: "F" };

type McSector = {
  ArrAirportCode?: string;
  ArrDateTime?: string;
  CabinName?: string | null;
  DepAirportCode?: string;
  DepDateTime?: string;
  ElapsedTime?: string | null;
  FlightNo?: string | null;
  MCarrier?: string | null;
  OCarrier?: string | null;
  AirV?: string | null;
};
type McLeg = { Sector?: McSector[] | null; Stops?: number | null; TotalTime?: string | null };
type McFare = {
  UniqueId?: string;
  Carrier?: string | null;
  Currency?: string | null;
  TotalPrice?: number | null;
  AdultPrice?: { Price?: number | null; NoPax?: number | null } | null;
  OutBound?: McLeg | null;
  InBound?: McLeg | null;
};
type McResponse = { Count?: number; Data?: McFare[] | null; Message?: string; message?: string; Error?: string };

/** Airline names for the carriers this supplier commonly returns. Unknown codes show the code. */
const AIRLINE_NAMES: Record<string, string> = {
  AA: "American Airlines", DL: "Delta Air Lines", UA: "United Airlines", B6: "JetBlue Airways",
  AS: "Alaska Airlines", WN: "Southwest Airlines", F9: "Frontier Airlines", MX: "Breeze Airways",
  SY: "Sun Country Airlines", HA: "Hawaiian Airlines", G4: "Allegiant Air", AC: "Air Canada",
  WS: "WestJet", BA: "British Airways", VS: "Virgin Atlantic", AF: "Air France", KL: "KLM",
  LH: "Lufthansa", LX: "Swiss", IB: "Iberia", AZ: "ITA Airways", TP: "TAP Air Portugal",
  EK: "Emirates", QR: "Qatar Airways", EY: "Etihad Airways", TK: "Turkish Airlines",
  AI: "Air India", SQ: "Singapore Airlines", CX: "Cathay Pacific", JL: "Japan Airlines",
  NH: "All Nippon Airways", KE: "Korean Air", OZ: "Asiana Airlines", AM: "Aeromexico",
  CM: "Copa Airlines", AV: "Avianca", LA: "LATAM", EI: "Aer Lingus", SV: "Saudia",
  PR: "Philippine Airlines", FI: "Icelandair", AY: "Finnair", SK: "SAS", LO: "LOT Polish Airlines",
};

function ddmmyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** "2026-12-10T12:00:00.000+00:00" -> local clock as written. */
function clock(s: string | undefined) {
  const m = s ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(s) : null;
  if (!m) return { date: "", label: "", minutes: 0, abs: NaN };
  const h = Number(m[2]), min = Number(m[3]);
  // Same "6:05 AM" style as the Duffel results.
  const label = `${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return { date: m[1]!, label, minutes: h * 60 + min, abs: Date.parse(`${m[1]}T${m[2]}:${m[3]}:00Z`) / 60_000 };
}

function hhmm(s: string | null | undefined): number {
  const m = s ? /^(\d+):(\d{2})/.exec(s) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

function fmtDuration(mins: number): string {
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function legInfo(leg: McLeg | null | undefined) {
  const sectors = (leg?.Sector ?? []).filter((s) => s.DepAirportCode && s.ArrAirportCode);
  if (!sectors.length) return null;
  const first = sectors[0]!;
  const last = sectors[sectors.length - 1]!;
  let maxLayover = 0;
  let layoverTotal = 0;
  for (let i = 1; i < sectors.length; i++) {
    // Both times are local clocks at the same connecting airport, so the gap is real.
    const gap = clock(sectors[i]!.DepDateTime).abs - clock(sectors[i - 1]!.ArrDateTime).abs;
    if (Number.isFinite(gap) && gap > 0) {
      maxLayover = Math.max(maxLayover, gap);
      layoverTotal += gap;
    }
  }
  const flown = sectors.reduce((s, x) => s + hhmm(x.ElapsedTime), 0);
  const durationMinutes = hhmm(leg?.TotalTime) || flown + layoverTotal;
  const dep = clock(first.DepDateTime);
  const arr = clock(last.ArrDateTime);
  const code = (first.MCarrier || first.AirV || first.OCarrier || "").toUpperCase().slice(0, 2);
  return {
    first,
    code,
    detail: allSegments(
      sectors.map((x) =>
        segment({
          carrier: x.MCarrier || x.AirV,
          operatingCarrier: x.OCarrier,
          flightNumber: x.FlightNo,
          origin: x.DepAirportCode,
          destination: x.ArrAirportCode,
          departure: localStamp(x.DepDateTime),
          arrival: localStamp(x.ArrDateTime),
        }),
      ),
    ),
    airline: AIRLINE_NAMES[code] ?? code,
    flightNo: `${code} ${first.FlightNo ?? ""}`.trim(),
    origin: first.DepAirportCode!.toUpperCase(),
    destination: last.ArrAirportCode!.toUpperCase(),
    departDate: dep.date,
    arriveDate: arr.date || dep.date,
    departTime: dep.label,
    arriveTime: arr.label,
    departMinutes: dep.minutes,
    arriveMinutes: arr.minutes,
    durationMinutes,
    maxLayover,
    stops: Math.max(0, sectors.length - 1),
  };
}

function normalise(f: McFare, requestedCabin: string, wantReturn: boolean, paxCount: number): PkfareNormalisedFare | null {
  const out = legInfo(f.OutBound);
  if (!out) return null;
  const ret = legInfo(f.InBound);
  // A round-trip search must return a priced return leg, or the fare is not what was asked for.
  if (wantReturn && !ret) return null;

  // Per-person price (the site labels and books prices per person). AdultPrice.Price is the
  // supplier's own per-adult total; otherwise the whole-trip total divided by travellers.
  const perAdult = Number(f.AdultPrice?.Price ?? NaN);
  const total = Number(f.TotalPrice ?? NaN);
  const price = Number.isFinite(perAdult) && perAdult > 0 ? perAdult : total / Math.max(1, paxCount);
  if (!Number.isFinite(price) || price <= 0) return null;

  const carrierCode = (f.Carrier || out.code || "").toUpperCase().slice(0, 2);
  const supplierCabin = out.first.CabinName?.trim();

  return {
    id: `mc:${f.UniqueId ?? `${out.flightNo}-${out.departDate}-${price}`}`,
    supplier: "mcontent",
    airline: AIRLINE_NAMES[carrierCode] ?? out.airline,
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
    cabin: supplierCabin ? supplierCabin.toUpperCase() : requestedCabin,
    currency: (f.Currency || "USD").toUpperCase(),
    price: Math.round(price),
    // The supplier does not say whether the fare is refundable, so it is never claimed.
    refundable: false,
    ...(ret
      ? {
          returnFlight: {
            airline: ret.airline,
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
    // The supplier's own whole-trip total for the EazAir feed. With one
    // traveller the per-person price is the total; otherwise it is left out
    // rather than multiplied.
    ...(Number.isFinite(total) && total > 0
      ? { totalPrice: Math.round(total) }
      : paxCount === 1
        ? { totalPrice: Math.round(price) }
        : {}),
    // MContent states no bags or fare rules, so no `terms` are sent.
    ...(out.detail ? { segments: out.detail } : {}),
  };
}

export async function runMContentSearch(query: PkfareSearchQuery): Promise<PkfareNormalisedFare[]> {
  const creds = mcontentCredentials();
  if (!creds) throw new Error("MContent is not configured (MContent_ID and MContent_Source secrets).");

  const cabinLabel = query.cabinClass ?? "Economy";
  const adults = Math.max(1, query.adults ?? 1);
  const children = Math.max(0, query.children ?? 0);
  const infants = Math.max(0, query.infants ?? 0);
  const params = new URLSearchParams({
    currency: (query.currency || "USD").toUpperCase(),
    origin: query.origin.toUpperCase(),
    destination: query.destination.toUpperCase(),
    departureDate: ddmmyyyy(query.departDate),
    ...(query.returnDate ? { returnDate: ddmmyyyy(query.returnDate) } : {}),
    JourneyType: query.returnDate ? "R" : "O",
    airlines: query.airline ? query.airline.toUpperCase() : "",
    cabin: CABIN_CODE[cabinLabel] ?? "Y",
    adults: String(adults),
    children: String(children),
    infants: String(infants),
    siteid: creds.siteId,
    source: creds.source,
  });

  console.info(
    "[MContent] search",
    `${query.origin}-${query.destination}@${query.departDate}${query.returnDate ? ` / ${query.returnDate}` : ""}`,
    `cabin=${params.get("cabin")} pax=${adults + children + infants}`,
  );

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/Soulservices?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[MContent] transport failure", (error as Error).message);
    throw new Error("We couldn't reach the flight provider just now. Please try again in a moment.");
  }

  let body: McResponse;
  try {
    body = (await res.json()) as McResponse;
  } catch (error) {
    console.error("[MContent] unreadable response", res.status, (error as Error).message);
    throw new Error("We couldn't read the flight provider's response. Please try again.");
  }
  if (!res.ok) {
    const detail = body.Message || body.message || body.Error || String(res.status);
    console.error(`[MContent] search failed (${res.status}: ${detail})`);
    throw new Error(`The flight provider couldn't complete that search (${res.status}).`);
  }

  let fares = (body.Data ?? [])
    .map((f) => normalise(f, cabinLabel, Boolean(query.returnDate), adults + children))
    .filter((f): f is PkfareNormalisedFare => f !== null)
    // Only fares for the airports actually asked for (city codes may return nearby airports,
    // which is fine; a different origin/destination pair entirely is not).
    .filter((f) => f.departDate === query.departDate);

  if (query.airline) {
    const hint = query.airline.toUpperCase();
    const matching = fares.filter((f) => f.carrierCode === hint);
    if (matching.length) fares = matching;
  }
  fares.sort((a, b) => a.price - b.price);
  const limit = query.solutions && query.solutions > 0 ? query.solutions : 50;
  fares = fares.slice(0, Math.max(limit, 1));
  console.info(`[MContent] ${body.Data?.length ?? 0} results -> ${fares.length} fares`);
  return fares;
}
