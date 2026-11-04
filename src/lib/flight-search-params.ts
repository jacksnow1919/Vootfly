export type FlightSearch = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  airline: string;
  flightNo: string;
  cabin: string;
  currency: string;
  /** Per-person price, taxes & fees included -- matches how search results label it. Never a grand total. */
  price: string;
  /** Number of travellers this fare applies to. Defaults to 1 only when genuinely absent, never guessed higher. */
  passengers?: string;
  utm_source?: string;
  utm_medium?: string;
  click_id?: string;
  promo_code?: string;
  discount_val?: string;
  discount_type?: string;
  discount_pct?: string;
  discount_amount?: string;
  original_price?: string;
  final_price?: string;
  /** Supplier that quoted this fare ("duffel", "mcontent", "pkfare"), so booking re-checks with the same one. */
  supplier?: string;
  /** The Duffel offer behind this fare. Without it a fare can only be requested, not paid for and booked. */
  offer?: string;
  /** Shows the card form while the vault is in test mode. Ordinary customers don't have it. */
  cardtest?: string;
};

const str = (v: unknown, fallback: string) => {
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
};

const CABIN_LABELS: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  premium: "Premium Economy",
  business: "Business",
  first: "First",
};

const cabinLabel = (raw: string) => CABIN_LABELS[raw.trim().toLowerCase()] ?? raw;

/**
 * Accepts both our internal params (`departDate`) and aggregator deep-link
 * aliases (`depart`, `return`) so partner links land straight in checkout.
 */
const AIRLINE_NAMES: Record<string, string> = {
  DL: "Delta Air Lines",
  UA: "United Airlines",
  AA: "American Airlines",
  B6: "JetBlue Airways",
  AS: "Alaska Airlines",
  BA: "British Airways",
  LH: "Lufthansa",
  EK: "Emirates",
  AF: "Air France",
  QR: "Qatar Airways",
};

export const parseFlightSearch = (search: Record<string, unknown>): FlightSearch => {
  const airlineRaw = str(search["airline"], "Emirates");
  const airline = AIRLINE_NAMES[airlineRaw.toUpperCase()] ?? airlineRaw;
  const code = (airlineRaw.replace(/[^A-Za-z0-9]/g, "").slice(0, 2) || "AS").toUpperCase();
  const paxRaw = Number(search["passengers"]);
  const passengers = Number.isFinite(paxRaw) && paxRaw > 0 ? String(Math.min(9, Math.round(paxRaw))) : "1";
  return {
  origin: str(search["origin"], "JFK").toUpperCase(),
  destination: str(search["destination"], "MIA").toUpperCase(),
  departDate: str(search["departDate"], str(search["depart"], "2026-08-19")),
  ...(str(search["returnDate"], str(search["return"], ""))
    ? { returnDate: str(search["returnDate"], str(search["return"], "")) }
    : {}),
  airline,
  flightNo: str(search["flightNo"], `${code} 204`),
  cabin: cabinLabel(str(search["cabin"], "Economy")),
  currency: str(search["currency"], "USD"),
  // No fabricated fallback price -- "0" makes a genuinely missing/broken
  // price param immediately obvious instead of silently showing a fixed
  // number (previously "1289") that looked like a real fare.
  price: str(search["price"], "0"),
  passengers,
  ...(str(search["utm_source"], "") ? { utm_source: str(search["utm_source"], "") } : {}),
  ...(str(search["utm_medium"], "") ? { utm_medium: str(search["utm_medium"], "") } : {}),
  ...(str(search["click_id"], "") ? { click_id: str(search["click_id"], "") } : {}),
  ...(str(search["promo_code"], "") ? { promo_code: str(search["promo_code"], "") } : {}),
  ...(str(search["discount_val"], "") ? { discount_val: str(search["discount_val"], "") } : {}),
  ...(str(search["discount_type"], "") ? { discount_type: str(search["discount_type"], "") } : {}),
  ...(str(search["discount_pct"], "") ? { discount_pct: str(search["discount_pct"], "") } : {}),
  ...(str(search["discount_amount"], "")
    ? { discount_amount: str(search["discount_amount"], "") }
    : {}),
  ...(str(search["original_price"], "")
    ? { original_price: str(search["original_price"], "") }
    : {}),
  ...(str(search["final_price"], "") ? { final_price: str(search["final_price"], "") } : {}),
  ...(["duffel", "mcontent", "pkfare"].includes(str(search["supplier"], "")) ? { supplier: str(search["supplier"], "") } : {}),
  ...(/^off_[A-Za-z0-9_-]{6,80}$/.test(str(search["offer"], "")) ? { offer: str(search["offer"], "") } : {}),
  ...(str(search["cardtest"], "") === "1" ? { cardtest: "1" } : {}),
  };
};


export const currencySymbol = (c: string) =>
  ({ USD: "$", EUR: "€", GBP: "£", INR: "₹", AED: "AED " })[c.toUpperCase()] ?? `${c} `;
