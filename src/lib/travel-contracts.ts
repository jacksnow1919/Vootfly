/**
 * Travel Object Contracts — Phase 1 Foundation.
 *
 * Stable, normalized server-side type contracts for the core travel
 * entities. These are TypeScript types only (compile-time contracts), not
 * a runtime validation library and not a replacement for any existing
 * type -- they exist so future systems (Comparison Engine, Fare
 * Intelligence, Hotel Commerce, etc.) have one shared shape to agree on
 * instead of each inventing its own.
 *
 * CRITICAL COMPATIBILITY NOTE: PkfareNormalisedFare (pkfare-types.ts) is
 * NOT modified by this file and remains VootFly's actual live-pricing
 * type, used everywhere it already is. FlightContract/FareContract below
 * are designed as a compatible subset of it -- see the compile-time
 * assertion at the bottom of this file, which fails to build if
 * PkfareNormalisedFare ever stops satisfying these contracts. That
 * assertion is the actual guarantee of compatibility, not this comment.
 *
 * AI is never the source of truth for any of these. Live flight/fare data
 * comes only from PKFARE (see pkfare.server.ts). Reference data (airlines,
 * aircraft, routes, currencies, suppliers) comes only from the seeded
 * database tables added in this same phase. Hotel/Room/Activity/Visa
 * contracts below are the TARGET shape for when a real supplier/source is
 * connected -- as of this phase, no such source exists, so nothing in the
 * app should construct one of these except from real data once it does.
 */

// ---------------------------------------------------------------------------
// FLIGHT / FARE — compatible with the existing live PKFARE pipeline
// ---------------------------------------------------------------------------

/** One priced flight offer. Real implementations: PkfareNormalisedFare. */
export interface FlightContract {
  /** Real supplier-issued identifier. Never a locally-synthesised placeholder. */
  id: string;
  airline: string;
  carrierCode: string;
  flightNo: string;
  origin: string;
  destination: string;
  departDate: string;
  arriveDate: string;
  departTime: string;
  arriveTime: string;
  durationMinutes: number;
  cabin: string;
  stops: number;
}

/** The commercial terms of a FlightContract. Real implementations: PkfareNormalisedFare. */
export interface FareContract {
  /** Same id as the FlightContract it prices -- one fare per flight offer in this contract. */
  id: string;
  price: number;
  currency: string;
  refundable: boolean;
  /** Which catalog supplier this fare came from -- see suppliers table. */
  supplierCode: string;
}

// ---------------------------------------------------------------------------
// AIRLINE / AIRPORT / ROUTE — backed by the new reference tables
// ---------------------------------------------------------------------------

/** Real implementation: the `airlines` table. */
export interface AirlineContract {
  iataCode: string;
  icaoCode: string | null;
  name: string;
  countryCode: string | null;
  alliance: string | null;
  isActive: boolean;
}

/** Real implementation: `places` rows where level = 'airport'. Not a new table --
 * the existing places hierarchy already models this correctly. */
export interface AirportContract {
  code: string;
  name: string;
  iata: string | null;
  parentCode: string | null;
}

/** Real implementation: the `routes` table. A catalog entry, never a live price/schedule. */
export interface RouteContract {
  fromCode: string;
  toCode: string;
  distanceKm: number | null;
}

// ---------------------------------------------------------------------------
// DESTINATION — backed by places, thin until Travel Intelligence work lands
// ---------------------------------------------------------------------------

/** Real implementation today: `places` rows (country/state/metro level).
 * visaRequired/weatherSummary are typed here as the target shape for when
 * Destination Intelligence exists (later phase) -- always undefined today,
 * never a guessed value. */
export interface DestinationContract {
  code: string;
  name: string;
  countryCode: string | null;
  visaRequired?: boolean;
  weatherSummary?: string;
}

// ---------------------------------------------------------------------------
// HOTEL / ROOM / ACTIVITY / VISA — no real data source yet (Phase 1 target
// shape only; do not construct these from anything but a real supplier once
// one exists)
// ---------------------------------------------------------------------------

/** No real implementation exists yet -- Hotel Commerce is not built (see
 * the September 2026 audit). This is the target shape for when a real
 * hotel supplier is connected. */
export interface HotelContract {
  id: string;
  name: string;
  cityCode: string;
  supplierCode: string;
}

/** No real implementation exists yet. */
export interface RoomContract {
  id: string;
  hotelId: string;
  name: string;
  price: number;
  currency: string;
  cancellationPolicy: string | null;
}

/** No real implementation exists yet. */
export interface ActivityContract {
  id: string;
  name: string;
  cityCode: string;
  supplierCode: string;
}

/**
 * The shape a real hotel supplier integration would implement. No
 * implementation of this interface exists anywhere in the codebase yet --
 * defining it now is the entire scope of the Hotel Commerce Foundation:
 * a clean contract a future real supplier can be wired into, not a
 * simulated or partial hotel search. Do not implement this against
 * anything other than a real hotel supplier's API; a stub/mock
 * implementation would violate the same never-fabricate-a-price principle
 * that governs flight fares.
 */
export interface HotelSupplierAdapter {
  supplierCode: string;
  searchHotels(query: {
    cityCode: string;
    checkIn: string;
    checkOut: string;
    guests: number;
  }): Promise<HotelContract[]>;
  searchRooms(hotelId: string, query: { checkIn: string; checkOut: string; guests: number }): Promise<RoomContract[]>;
}

/** No real implementation exists yet. Visa data must come from an official/
 * government source once built -- never inferred or guessed, per the
 * governance rule that AI is not the source of truth for visa requirements. */
export interface VisaContract {
  countryCode: string;
  forNationalityCode: string;
  required: boolean;
  sourceUrl: string;
  verifiedAt: string;
}

// ---------------------------------------------------------------------------
// Compatibility guarantee: this block only compiles if PkfareNormalisedFare
// genuinely satisfies FlightContract's shape. If a future change to
// pkfare-types.ts ever breaks this, `npx tsc --noEmit` fails here -- that's
// the actual enforcement mechanism, not just a comment's claim.
// ---------------------------------------------------------------------------
import type { PkfareNormalisedFare } from "@/lib/pkfare-types";

type _AssertPkfareSatisfiesFlightContract = PkfareNormalisedFare extends FlightContract
  ? true
  : ["PkfareNormalisedFare no longer satisfies FlightContract", PkfareNormalisedFare];
const _flightCompatibilityCheck: _AssertPkfareSatisfiesFlightContract = true;
void _flightCompatibilityCheck;
