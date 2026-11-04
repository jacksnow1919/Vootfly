/**
 * PKFARE Flight Buyer API (Shopping V4) — SERVER ONLY.
 * Credentials (PKFARE_PARTNER_ID / PKFARE_PARTNER_KEY) never reach the browser.
 *
 * Transport quirks handled here:
 *  - auth is `sign = md5(partnerId + partnerKey)` inside the JSON body
 *  - the JSON body is base64-encoded and POSTed as a `param` form field
 *  - flights/segments come back as flat pools referenced by id
 */
import type {
  PkfareNormalisedFare,
  PkfareRawFlight,
  PkfareRawSegment,
  PkfareRawSolution,
  PkfareSearchQuery,
  PkfareSearchResponse,
} from "./pkfare-types";
import { allSegments, localStamp, segment, terms } from "./supplier-segments";

const BASE_URL = "https://api.pkfare.com";
const SHOPPING_PATH = "/shoppingV4";
const REQUEST_TIMEOUT_MS = 30_000;


/** Minimal dependency-free MD5 (RFC 1321) — PKFARE requires MD5(partnerId + partnerKey). */
export function md5(input: string): string {
  const rotl = (n: number, c: number) => (n << c) | (n >>> (32 - c));
  const add = (a: number, b: number) => (a + b) | 0;

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
    20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
    10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));

  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  new DataView(padded.buffer).setUint32(padded.length - 8, bitLen, true);

  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const view = new DataView(padded.buffer);

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    const M = Array.from({ length: 16 }, (_, i) => view.getUint32(chunk + i * 4, true));
    let [A, B, C, D] = [a0, b0, c0, d0];

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = add(add(add(F, A), K[i]!), M[g]!);
      A = D;
      D = C;
      C = B;
      B = add(B, rotl(F, S[i]!));
    }

    a0 = add(a0, A);
    b0 = add(b0, B);
    c0 = add(c0, C);
    d0 = add(d0, D);
  }

  const hex = (n: number) =>
    Array.from({ length: 4 }, (_, i) => ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, "0")).join(
      "",
    );
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

function credentials() {
  const partnerId = process.env["PKFARE_PARTNER_ID"];
  const partnerKey = process.env["PKFARE_PARTNER_KEY"];
  if (!partnerId || !partnerKey) throw new Error("PKFARE credentials are not configured");
  return { partnerId, sign: md5(`${partnerId}${partnerKey}`) };
}

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * PKFARE expects the whole JSON payload (authentication + search) stringified,
 * Base64-encoded, and POSTed as the `param` form field.
 */
export async function pkfarePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const authentication = credentials();
  const base = (process.env["PKFARE_BASE_URL"] || BASE_URL).replace(/\/+$/, "");
  const param = toBase64(JSON.stringify({ authentication, ...body }));

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ param }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[PKFARE] transport failure", error);
    throw new Error("We couldn't reach the flight provider just now. Please try again in a moment.");
  }

  if (!res.ok) {
    let text = "";
    try {
      text = (await res.text()).slice(0, 300).replace(/\s+/g, " ");
    } catch {
      text = "<unreadable>";
    }
    console.error(`[PKFARE] ${base}${path} failed (${res.status}): ${text}`);
    throw new Error("The flight provider returned an error. Please try again shortly.");
  }

  try {
    return (await res.json()) as T;
  } catch (error) {
    console.error("[PKFARE] unreadable response", error);
    throw new Error("We couldn't read the flight provider's response. Please try again.");
  }
}

const minutesToDuration = (m?: number) =>
  m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : "—";

const timeOf = (t?: string | null) => (t ? (t.length > 5 ? t.slice(0, 5) : t) : "");

/** One resolved journey (outbound or return) worth of raw segments plus PKFARE's own duration for it. */
type ResolvedLeg = { segments: PkfareRawSegment[]; journeyTime: number };

function solutionLegs(
  solution: PkfareRawSolution,
  flightsById: Map<string, PkfareRawFlight>,
  segmentsById: Map<string, PkfareRawSegment>,
): ResolvedLeg[] | null {
  const journeyKeys = Object.keys(solution.journeys ?? {}).sort();
  const legs: ResolvedLeg[] = [];

  for (const key of journeyKeys) {
    const legSegments: PkfareRawSegment[] = [];
    let journeyTime = 0;
    for (const flightId of solution.journeys?.[key] ?? []) {
      const flight = flightsById.get(flightId);
      if (!flight) return null;
      journeyTime += flight.journeyTime ?? 0;
      for (const segmentId of flight.segmengtIds ?? flight.segmentIds ?? []) {
        const segment = segmentsById.get(segmentId);
        if (!segment) return null;
        legSegments.push(segment);
      }
    }
    if (legSegments.length > 0) legs.push({ segments: legSegments, journeyTime });
  }

  return legs.length > 0 ? legs : null;
}

/**
 * Fallback when PKFARE's response gives a bare 2-3 letter carrier code instead
 * of a full airline name (observed for Saudia/"SV"). Not exhaustive -- extend
 * as new bare-code cases turn up rather than trying to cover every IATA code.
 */
const AIRLINE_CODE_FALLBACK: Record<string, string> = {
  SV: "Saudia",
  WY: "Oman Air",
  GF: "Gulf Air",
  KU: "Kuwait Airways",
  RJ: "Royal Jordanian",
  MS: "EgyptAir",
  ET: "Ethiopian Airlines",
  SA: "South African Airways",
  AI: "Air India",
  PK: "Pakistan International Airlines",
  UL: "SriLankan Airlines",
  VN: "Vietnam Airlines",
  GA: "Garuda Indonesia",
  PR: "Philippine Airlines",
  CI: "China Airlines",
  BR: "EVA Air",
  KE: "Korean Air",
  OZ: "Asiana Airlines",
  AC: "Air Canada",
  WS: "WestJet",
  AM: "Aeromexico",
  CM: "Copa Airlines",
  AV: "Avianca",
  LA: "LATAM Airlines",
  IB: "Iberia",
  AZ: "ITA Airways",
  SN: "Brussels Airlines",
  OS: "Austrian Airlines",
  LX: "Swiss International Air Lines",
  SK: "SAS",
  AY: "Finnair",
  VS: "Virgin Atlantic",
  NZ: "Air New Zealand",
  QF: "Qantas",
  CX: "Cathay Pacific",
  JL: "Japan Airlines",
  MH: "Malaysia Airlines",
  TG: "Thai Airways",
  CZ: "China Southern Airlines",
  MU: "China Eastern Airlines",
  CA: "Air China",
};

function resolvedAirlineName(rawAirline: string): string {
  return /^[A-Z0-9]{2,3}$/i.test(rawAirline.trim())
    ? (AIRLINE_CODE_FALLBACK[rawAirline.toUpperCase()] ?? rawAirline)
    : rawAirline;
}

/**
 * Builds the shared set of derived fields (airline, flight number, duration,
 * etc.) for one leg's segments -- used for both the outbound leg (the main
 * PkfareNormalisedFare fields) and the return leg (the nested `returnFlight`),
 * so the same duration/airline-name/flight-number logic isn't duplicated and
 * can't drift out of sync between the two.
 */
function buildLegSummary(leg: ResolvedLeg, platingCarrier: string | undefined) {
  const { segments, journeyTime } = leg;
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;

  const segmentMinutes = segments.reduce((sum, seg) => sum + (seg.flightTime ?? 0), 0);

  // Layovers = gap between one segment's arrival and the next segment's departure.
  let maxLayoverMinutes = 0;
  for (let i = 1; i < segments.length; i++) {
    const prev = toMinutesStamp(segments[i - 1]!.strArrivalDate, segments[i - 1]!.strArrivalTime);
    const next = toMinutesStamp(segments[i]!.strDepartureDate, segments[i]!.strDepartureTime);
    if (prev !== null && next !== null && next > prev) {
      maxLayoverMinutes = Math.max(maxLayoverMinutes, next - prev);
    }
  }

  // Total elapsed journey time. PKFARE's own `flight.journeyTime` is the
  // authoritative source -- it's computed on their side, which has real
  // per-airport timezone data. Our own reconstruction from strDepartureTime/
  // strArrivalTime CANNOT be correct for a route crossing timezones: those
  // are local clock times at each airport, and toMinutesStamp treats them
  // as if both were UTC, so the result is off by exactly the real UTC-offset
  // difference between origin and destination (confirmed 2026-09-08 on a
  // DXB(+4)/YYZ(-4) result: displayed "9h 40m" for 08:50->18:30, but that's
  // the naive same-timezone diff -- true elapsed is ~8h longer). Kept as a
  // fallback only, for the rare case journeyTime is missing/zero, since it's
  // still correct for a same-timezone route and is closer to reality than
  // the old segmentMinutes+maxLayoverMinutes formula (which dropped every
  // layover but the single longest on any 2+ stop itinerary).
  const departStamp = toMinutesStamp(first.strDepartureDate, first.strDepartureTime);
  const arriveStamp = toMinutesStamp(last.strArrivalDate, last.strArrivalTime);
  const reconstructedMinutes =
    departStamp !== null && arriveStamp !== null && arriveStamp > departStamp
      ? arriveStamp - departStamp
      : segmentMinutes + maxLayoverMinutes;
  const totalMinutes = journeyTime > 0 ? journeyTime : reconstructedMinutes;

  const carrierCode = (platingCarrier || first.airline || "").toUpperCase().slice(0, 2);
  const airline = resolvedAirlineName(platingCarrier || first.airline || "");

  // Every segment's flight number, not just the first leg's. Two genuinely
  // different itineraries can share the same first leg (PKFARE pools shared
  // flight/segment objects across solutions), so using only `first`'s number
  // let two different-stop-count results both show as plain "EK 71" with no
  // way to tell them apart (found 2026-09-08).
  const flightNo = segments.map((seg) => `${seg.airline} ${seg.flightNum}`).join(" / ");

  return {
    first,
    last,
    airline,
    carrierCode,
    flightNo,
    origin: first.departure,
    destination: last.arrival,
    departDate: first.strDepartureDate ?? "",
    arriveDate: last.strArrivalDate ?? first.strDepartureDate ?? "",
    departTime: timeOf(first.strDepartureTime),
    arriveTime: timeOf(last.strArrivalTime),
    duration: minutesToDuration(totalMinutes || undefined),
    durationMinutes: totalMinutes,
    maxLayoverMinutes,
    stops: Math.max(0, segments.length - 1),
  };
}

function normaliseSolution(
  solution: PkfareRawSolution,
  index: number,
  flightsById: Map<string, PkfareRawFlight>,
  segmentsById: Map<string, PkfareRawSegment>,
  fallbackCabin: string,
): PkfareNormalisedFare | null {
  // Every displayed fare must carry a real PKFARE-issued identifier -- never
  // a locally-synthesised placeholder (previously `solution-${index}` when
  // both real ID fields were missing). A fare with no real offer ID isn't
  // actually bookable/traceable back to a specific PKFARE offer, so it's
  // dropped here rather than shown with a fake-looking but meaningless ID.
  const offerId = solution.solutionId || solution.solutionKey;
  if (!offerId) return null;

  const legs = solutionLegs(solution, flightsById, segmentsById);
  if (!legs) return null;

  const price =
    (solution.adtFare ?? 0) +
    (solution.adtTax ?? 0) +
    (solution.qCharge ?? 0) +
    (solution.tktFee ?? 0);
  if (price <= 0) return null;

  const outbound = buildLegSummary(legs[0]!, solution.platingCarrier);
  // legs[1] present == this solution has a return leg (searched with a
  // returnDate). Its own flight details are surfaced via `returnFlight` for
  // display -- the price above already covers both legs as one total, same
  // as PKFARE returns it; there's no separate return-leg price to show.
  const returnLeg = legs[1] ? buildLegSummary(legs[1], solution.platingCarrier) : null;
  const outDetail = pkfareDetail(legs[0]);
  const backDetail = pkfareDetail(legs[1]);
  // Only a refundable flag PKFARE actually sent; `refundable` below is false when it sent none.
  const offerTerms = terms({
    refundable: typeof solution.refundable === "boolean" ? solution.refundable : undefined,
  });

  return {
    id: offerId,
    airline: outbound.airline,
    carrierCode: outbound.carrierCode,
    flightNo: outbound.flightNo,
    origin: outbound.origin,
    destination: outbound.destination,
    departDate: outbound.departDate,
    arriveDate: outbound.arriveDate,
    departTime: outbound.departTime,
    arriveTime: outbound.arriveTime,
    duration: outbound.duration,
    durationMinutes: outbound.durationMinutes,
    departMinutes: clockMinutes(outbound.first.strDepartureTime),
    arriveMinutes: clockMinutes(outbound.last.strArrivalTime),
    maxLayoverMinutes: outbound.maxLayoverMinutes,
    cabin: outbound.first.cabinClass || fallbackCabin,
    currency: solution.currency || "USD",
    price: Math.round(price),
    refundable: solution.refundable === true,
    stops: outbound.stops,
    ...(returnLeg
      ? {
          returnFlight: {
            airline: returnLeg.airline,
            flightNo: returnLeg.flightNo,
            origin: returnLeg.origin,
            destination: returnLeg.destination,
            departDate: returnLeg.departDate,
            arriveDate: returnLeg.arriveDate,
            departTime: returnLeg.departTime,
            arriveTime: returnLeg.arriveTime,
            duration: returnLeg.duration,
            durationMinutes: returnLeg.durationMinutes,
            stops: returnLeg.stops,
            ...(backDetail ? { segments: backDetail } : {}),
          },
        }
      : {}),
    ...(outDetail ? { segments: outDetail } : {}),
    ...(offerTerms ? { terms: offerTerms } : {}),
  };
}

/** PKFARE's own segments as EazAir contract v2 segments, all or none. */
function pkfareDetail(leg: ResolvedLeg | undefined) {
  if (!leg) return undefined;
  return allSegments(
    leg.segments.map((seg) =>
      segment({
        carrier: seg.airline,
        flightNumber: seg.flightNum,
        origin: seg.departure,
        destination: seg.arrival,
        departure: localStamp(seg.strDepartureDate, seg.strDepartureTime ?? null),
        arrival: localStamp(seg.strArrivalDate, seg.strArrivalTime ?? null),
        aircraft: seg.equipment,
      }),
    ),
  );
}

/** Minutes since midnight for a "HH:mm" style time string. */
function clockMinutes(time?: string | null): number {
  const t = timeOf(time);
  const [h, m] = t.split(":");
  const hours = Number(h);
  const mins = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return 0;
  return hours * 60 + mins;
}

/** Absolute minute stamp from a yyyy-MM-dd date plus HH:mm time. */
function toMinutesStamp(date?: string | null, time?: string | null): number | null {
  if (!date) return null;
  const parsed = Date.parse(`${date}T${timeOf(time) || "00:00"}:00Z`);
  return Number.isFinite(parsed) ? Math.round(parsed / 60000) : null;
}

/**
 * PKFARE rejects any leg outside "today .. today + 1 year" with error B038
 * ("Departure date must be today to a year."). Guard here so a stale/past
 * date (e.g. a cached link or the flexible-date strip stepping backwards)
 * yields an empty result set instead of a thrown provider error.
 */
function dateOutOfProviderRange(date?: string): boolean {
  if (!date) return false;
  const stamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(stamp)) return true;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const oneYear = today + 365 * 24 * 60 * 60 * 1000;
  return stamp < today || stamp > oneYear;
}

/**
 * Every fare search on the site goes through here (live search, fare re-check
 * before booking, route page snapshots, the EazAir supplier endpoint).
 * Since 31 Oct 2026 (PKFARE down) it uses Duffel whenever a Duffel key is set,
 * unless FARE_PROVIDER=pkfare; see fare-provider.server.ts. The name is kept so
 * no caller had to change.
 */
export async function runPkfareSearch(query: PkfareSearchQuery): Promise<PkfareNormalisedFare[]> {
  if (dateOutOfProviderRange(query.departDate) || dateOutOfProviderRange(query.returnDate)) {
    console.info(`[fares] skipping out-of-range search ${query.departDate}${query.returnDate ? ` / ${query.returnDate}` : ""}`);
    return [];
  }
  const { liveFareProviders } = await import("./fare-provider.server");
  const { keepAlive, pausedProviders } = await import("./provider-control.server");
  const paused = await pausedProviders();
  const providers = (query.supplier ? [query.supplier] : liveFareProviders()).filter((p) => !paused.has(p));
  if (providers.length === 0) return [];
  if (providers.length === 1) return runOneSupplier(providers[0]!, query);
  const runs = providers.map((p) => runOneSupplier(p, query));
  // Slower APIs finish after the customer has fares, so their answers still get recorded.
  keepAlive(Promise.allSettled(runs));
  return firstWithFares(runs);
}

/** One supplier's search, with every fare tagged with that supplier. */
async function runOneSupplier(
  supplier: "duffel" | "mcontent" | "pkfare",
  query: PkfareSearchQuery,
): Promise<PkfareNormalisedFare[]> {
  const run =
    supplier === "duffel"
      ? (await import("./duffel.server")).runDuffelSearch
      : supplier === "mcontent"
        ? (await import("./mcontent.server")).runMContentSearch
        : runPkfareSearchDirect;
  const { logProviderAnswer } = await import("./provider-control.server");
  const started = Date.now();
  const answer = { supplier, origin: query.origin, destination: query.destination };
  try {
    const fares = await run(query);
    logProviderAnswer({ ...answer, fares: fares.length, durationMs: Date.now() - started, error: null });
    return fares.map((f) => ({ ...f, supplier }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logProviderAnswer({ ...answer, fares: 0, durationMs: Date.now() - started, error: message });
    throw error;
  }
}

/**
 * Asks every supplier at once and returns the first result that has fares (owner's
 * instruction, 1 Nov 2026). A supplier that errors or returns nothing does not win; if
 * none has fares, an empty list is returned, or the first error when every one failed.
 */
function firstWithFares(runs: Promise<PkfareNormalisedFare[]>[]): Promise<PkfareNormalisedFare[]> {
  return new Promise((resolve, reject) => {
    let pending = runs.length;
    let anyEmpty = false;
    let firstError: unknown = null;
    let done = false;
    const settle = () => {
      if (done || --pending > 0) return;
      done = true;
      if (anyEmpty || !firstError) resolve([]);
      else reject(firstError);
    };
    for (const run of runs) {
      run.then(
        (fares) => {
          if (done) return;
          if (fares.length) {
            done = true;
            console.info(`[fares] first with fares: ${fares[0]?.supplier ?? "?"} (${fares.length})`);
            resolve(fares);
            return;
          }
          anyEmpty = true;
          settle();
        },
        (err) => {
          if (done) return;
          console.warn("[fares] supplier failed", (err as Error)?.message ?? err);
          firstError ??= err;
          settle();
        },
      );
    }
  });
}

/** The original PKFARE search, unchanged. */
export async function runPkfareSearchDirect(query: PkfareSearchQuery): Promise<PkfareNormalisedFare[]> {
  if (dateOutOfProviderRange(query.departDate) || dateOutOfProviderRange(query.returnDate)) {
    console.info(
      `[PKFARE] skipping out-of-range search ${query.departDate}${query.returnDate ? ` / ${query.returnDate}` : ""}`,
    );
    return [];
  }

  const cabinClass = query.cabinClass ?? "Economy";

  const searchAirLegs = [
    {
      cabinClass,
      departureDate: query.departDate,
      origin: query.origin,
      destination: query.destination,
    },
    ...(query.returnDate
      ? [
          {
            cabinClass,
            departureDate: query.returnDate,
            origin: query.destination,
            destination: query.origin,
          },
        ]
      : []),
  ];

  console.info(
    "[PKFARE] shopping request",
    searchAirLegs.map((l) => `${l.origin}-${l.destination}@${l.departureDate}`).join(" | "),
    `cabin=${cabinClass} adults=${query.adults ?? 1} airline=${query.airline ?? "any"}`,
  );

  const res = await pkfarePost<PkfareSearchResponse>(SHOPPING_PATH, {
    search: {
      adults: query.adults ?? 1,
      children: query.children ?? 0,
      infants: query.infants ?? 0,
      nonstop: 0,
      airline: (query.airline ?? "").toUpperCase().slice(0, 2),
      solutions: Math.min(Math.max(query.solutions ?? 20, 20), 100),
      // Tested 2026-09-10 (n8n execution 2603): a top-level currency field
      // here is silently ignored -- every result still came back USD
      // despite requesting EUR. Left in in case PKFARE's account-level
      // config or a different field name is what actually controls this
      // (no official docs available to confirm), but don't rely on this
      // for real multi-currency quotes -- see currency.ts for the
      // display-only conversion approach used instead.
      currency: (query.currency || "USD").toUpperCase(),
      searchAirLegs,
    },
  });

  const code = String(res.errorCode ?? "0");
  if (code !== "0" && code !== "S") {
    console.error(`[PKFARE] api error ${code}: ${res.errorMsg ?? ""}`);
    throw new Error(
      res.errorMsg
        ? `The flight provider couldn't complete that search (${code}).`
        : `PKFARE error ${code}`,
    );
  }

  const flightsById = new Map((res.data?.flights ?? []).map((f) => [f.flightId, f]));
  const segmentsById = new Map((res.data?.segments ?? []).map((s) => [s.segmentId, s]));
  const solutions = res.data?.solutions ?? [];

  const fares = solutions
    .map((solution, index) =>
      normaliseSolution(solution, index, flightsById, segmentsById, cabinClass),
    )
    .filter((fare): fare is PkfareNormalisedFare => fare !== null)
    .sort((a, b) => a.price - b.price);

  // CABIN VERIFICATION (added 2026-09-16).
  // We already proved PKFARE silently ignores a requested `currency` field.
  // Evidence strongly suggests it does the same with cabinClass: when this
  // project switched every route from Business to Economy and re-fetched,
  // long-haul fares did not fall as they should have -- two rose, and
  // New York to Bangkok came back byte-identical at $5,169. An identical
  // price across a genuine cabin change is not plausible.
  //
  // Nothing here filters or alters a fare. It makes the discrepancy VISIBLE
  // instead of silently accepted, so the requested-vs-returned cabin can be
  // checked against real data rather than assumed.
  const norm = (c: string) =>
    c.trim().toLowerCase().replace(/\s+/g, "").replace(/^y$/, "economy").replace(/^[cj]$/, "business").replace(/^f$/, "first").replace(/^[ws]$/, "premiumeconomy");
  const requested = norm(cabinClass);
  const returnedCabins = [...new Set(fares.map((f) => f.cabin).filter(Boolean))] as string[];
  const mismatched = returnedCabins.filter((c) => norm(c) !== requested);
  if (mismatched.length) {
    console.warn(
      `[PKFARE] CABIN MISMATCH -- requested "${cabinClass}" but provider returned: ${mismatched.join(", ")}. ` +
        `Fares are NOT being filtered; this is a visibility warning. Route ${query.origin}-${query.destination} ${query.departDate}.`,
    );
  }

  console.info(
    `[PKFARE] ${solutions.length} solutions -> ${fares.length} fares` +
      (returnedCabins.length ? ` | returned cabins: ${returnedCabins.join(", ")}` : ""),
  );
  return fares;
}

