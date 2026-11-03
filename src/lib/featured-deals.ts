import { airports } from "@/lib/airports";

export type FeaturedDeal = {
  from: string;
  to: string;
  trip: string;
  price: number;
  cabin?: string;
  airline?: string;
  currency?: string;
  expiresAt?: string | null;
  originCode: string;
  destinationCode: string;
  departureDate: string;
  cabinClass: string;
};

/** Default future departure date for deal cards (YYYY-MM-DD). */
export const DEFAULT_DEAL_DEPARTURE_DATE = "2026-11-15";

/** City names that may appear in the deals table but are not exact airport cities. */
const CITY_CODE_OVERRIDES: Record<string, string> = {
  spain: "MAD",
  australia: "SYD",
  turkey: "IST",
  "new york": "JFK",
  "los angeles": "LAX",
  chicago: "ORD",
  "san francisco": "SFO",
  dallas: "DFW",
  denver: "DEN",
  miami: "MIA",
  atlanta: "ATL",
  boston: "BOS",
  seattle: "SEA",
  london: "LHR",
  paris: "CDG",
  dubai: "DXB",
  bangkok: "BKK",
  dhaka: "DAC",
  delhi: "DEL",
  mumbai: "BOM",
};

/** Resolve a free-text city name to a 3-letter IATA code. Falls back to the original name. */
export function cityToIata(city: string): string {
  const normalized = city.trim().toLowerCase();
  if (CITY_CODE_OVERRIDES[normalized]) return CITY_CODE_OVERRIDES[normalized];

  const match = airports.find(
    (a) =>
      a.city.toLowerCase() === normalized ||
      a.cityCode?.toLowerCase() === normalized ||
      a.name.toLowerCase().includes(normalized)
  );
  return match?.code ?? city.toUpperCase();
}

/** Normalize a human cabin label to a URL-friendly code. */
export function normalizeCabinClass(raw?: string | null): string {
  if (!raw) return "economy";
  const label = raw.trim().toLowerCase();
  if (label.includes("first")) return "first";
  if (label.includes("business")) return "business";
  if (label.includes("premium")) return "premium_economy";
  if (label.includes("economy")) return "economy";
  return label;
}

export const featuredDeals: FeaturedDeal[] = [
  {
    from: "London",
    to: "Paris",
    trip: "One Way",
    price: 399,
    cabin: "Economy",
    airline: "British Airways",
    originCode: "LHR",
    destinationCode: "CDG",
    departureDate: DEFAULT_DEAL_DEPARTURE_DATE,
    cabinClass: "economy",
  },
  {
    from: "Dubai",
    to: "Spain",
    trip: "Round-Trip",
    price: 570,
    cabin: "Economy",
    airline: "Emirates",
    originCode: "DXB",
    destinationCode: "MAD",
    departureDate: DEFAULT_DEAL_DEPARTURE_DATE,
    cabinClass: "economy",
  },
  {
    from: "Bangkok",
    to: "Australia",
    trip: "One Way",
    price: 399,
    cabin: "Economy",
    airline: "Qantas",
    originCode: "BKK",
    destinationCode: "SYD",
    departureDate: DEFAULT_DEAL_DEPARTURE_DATE,
    cabinClass: "economy",
  },
  {
    from: "London",
    to: "Turkey",
    trip: "Round-Trip",
    price: 599,
    cabin: "Economy",
    airline: "Turkish Airlines",
    originCode: "LHR",
    destinationCode: "IST",
    departureDate: DEFAULT_DEAL_DEPARTURE_DATE,
    cabinClass: "economy",
  },
  {
    from: "New York",
    to: "Dubai",
    trip: "Round-Trip",
    price: 599,
    cabin: "Economy",
    airline: "Emirates",
    originCode: "JFK",
    destinationCode: "DXB",
    departureDate: DEFAULT_DEAL_DEPARTURE_DATE,
    cabinClass: "economy",
  },
  {
    from: "Dhaka",
    to: "Chicago",
    trip: "One Way",
    price: 399,
    cabin: "Economy",
    airline: "Qatar Airways",
    originCode: "DAC",
    destinationCode: "ORD",
    departureDate: DEFAULT_DEAL_DEPARTURE_DATE,
    cabinClass: "economy",
  },
];
