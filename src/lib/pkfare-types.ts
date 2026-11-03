/** Shared PKFARE types — safe to import from client and server code. */
import type { SupplierFareTerms, SupplierSegment } from "./supplier-segments";

export interface PkfareSearchQuery {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | undefined;
  adults?: number | undefined;
  children?: number | undefined;
  infants?: number | undefined;
  cabinClass?: "Economy" | "PremiumEconomy" | "Business" | "First" | undefined;
  currency?: string | undefined;
  solutions?: number | undefined;
  /** Optional 2-letter carrier hint passed straight to the provider. */
  airline?: string | undefined;
  /**
   * Ask one specific supplier (1 Nov 2026). Used by the fare re-check before booking, so a
   * fare is re-checked with the same supplier that quoted it. Omit to let the site choose.
   */
  supplier?: FareSupplier | undefined;
}

/** Live fare suppliers the site can use (1 Nov 2026). */
export type FareSupplier = "duffel" | "mcontent" | "pkfare";
export const FARE_SUPPLIERS: readonly FareSupplier[] = ["duffel", "mcontent", "pkfare"];

/** Raw Shopping V4 shapes. Flights/segments arrive as flat pools keyed by id. */
export interface PkfareRawSegment {
  segmentId: string;
  airline: string;
  flightNum: string;
  cabinClass?: string | null;
  departure: string;
  arrival: string;
  flightTime?: number | null;
  strDepartureDate?: string | null;
  strDepartureTime?: string | null;
  strArrivalDate?: string | null;
  strArrivalTime?: string | null;
  departureDate?: number | null;
  arrivalDate?: number | null;
  equipment?: string | null;
  aircraftCode?: string | null;
}

export interface PkfareRawFlight {
  flightId: string;
  journeyTime?: number | null;
  transferCount?: number | null;
  /** The provider really does misspell this; older payloads use `segmentIds`. */
  segmengtIds?: string[];
  segmentIds?: string[];
}

export interface PkfareRawSolution {
  solutionId?: string;
  solutionKey?: string;
  currency?: string;
  adtFare?: number;
  adtTax?: number;
  qCharge?: number;
  tktFee?: number;
  platingCarrier?: string;
  journeys?: Record<string, string[]>;
  refundable?: boolean | null;
}

export interface PkfareSearchResponse {
  errorCode?: string | number;
  errorMsg?: string | undefined;
  data?: {
    solutions?: PkfareRawSolution[];
    flights?: PkfareRawFlight[];
    segments?: PkfareRawSegment[];
  };
}


export interface PkfareNormalisedFare {
  id: string;
  /** Which supplier returned this fare (1 Nov 2026). Carried into booking so the re-check asks the same one. */
  supplier?: FareSupplier | undefined;
  airline: string;
  /** 2-letter plating carrier code, used for airline + alliance filters. */
  carrierCode: string;
  flightNo: string;
  origin: string;
  destination: string;
  departDate: string;
  /** Arrival date (yyyy-MM-dd), may differ from departDate on long/overnight itineraries. */
  arriveDate: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  /** Total trip minutes including layovers. */
  durationMinutes: number;
  /** Departure time as minutes since midnight. */
  departMinutes: number;
  /** Arrival time as minutes since midnight. */
  arriveMinutes: number;
  /** Longest single layover in minutes (0 when non-stop). */
  maxLayoverMinutes: number;
  cabin: string;
  currency: string;
  price: number;
  refundable: boolean;
  /**
   * Present only when this fare was searched with a returnDate and PKFARE's
   * solution included a second (return) journey -- the price already covers
   * both legs (it's the whole solution's total), this is just the return
   * leg's own flight details for display. Absent on one-way results.
   */
  returnFlight?: {
    airline: string;
    flightNo: string;
    origin: string;
    destination: string;
    departDate: string;
    arriveDate: string;
    departTime: string;
    arriveTime: string;
    duration: string;
    durationMinutes: number;
    stops: number;
    /** The return flights one by one, as the supplier sent them (EazAir contract v2). */
    segments?: SupplierSegment[];
  };
  stops: number;
  /** The outbound flights one by one, as the supplier sent them (EazAir contract v2). */
  segments?: SupplierSegment[];
  /** Only the fare terms the supplier stated for this offer (EazAir contract v2). */
  terms?: SupplierFareTerms;
  /**
   * The whole trip for every traveller, as the supplier sent it, when `price`
   * is per person (MContent). The EazAir feed's total_price uses this.
   */
  totalPrice?: number;
}
