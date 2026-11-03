/**
 * IATA code -> airline name, client-safe.
 *
 * PKFARE sometimes returns only a 2-letter carrier code in a fare's
 * `airline` field instead of the full name, which surfaced on live pages as
 * bare codes ("EY" next to "EgyptAir"). The same real mapping already
 * existed in three places -- AIRLINE_CODE_FALLBACK in pkfare.server.ts
 * (server-only), AIRLINE_NAMES in flight.search.tsx, and the `airlines`
 * reference table seeded in Phase 1 -- but none of them were reachable from
 * the shared page components. This is that same vetted data in one
 * client-safe module so route and hub pages resolve codes consistently.
 *
 * Real IATA codes and real carrier names only. A code that isn't here is
 * displayed exactly as the provider sent it rather than guessed at.
 */
const AIRLINE_NAMES: Record<string, string> = {
  ZG: "ZIPAIR", DE: "Condor", UX: "Air Europa",
  QR: "Qatar Airways", EK: "Emirates", SQ: "Singapore Airlines", NH: "ANA",
  DL: "Delta", LH: "Lufthansa", BA: "British Airways", AA: "American Airlines",
  UA: "United Airlines", AF: "Air France", EY: "Etihad Airways", TK: "Turkish Airlines",
  SV: "Saudia", WY: "Oman Air", GF: "Gulf Air", KU: "Kuwait Airways",
  RJ: "Royal Jordanian", MS: "EgyptAir", ET: "Ethiopian Airlines", SA: "South African Airways",
  AI: "Air India", PK: "Pakistan International Airlines", UL: "SriLankan Airlines",
  VN: "Vietnam Airlines", GA: "Garuda Indonesia", PR: "Philippine Airlines",
  CI: "China Airlines", BR: "EVA Air", KE: "Korean Air", OZ: "Asiana Airlines",
  AC: "Air Canada", WS: "WestJet", AM: "Aeromexico", CM: "Copa Airlines",
  AV: "Avianca", LA: "LATAM Airlines", IB: "Iberia", AZ: "ITA Airways",
  SN: "Brussels Airlines", OS: "Austrian Airlines", LX: "Swiss International Air Lines",
  SK: "SAS", AY: "Finnair", VS: "Virgin Atlantic", NZ: "Air New Zealand",
  QF: "Qantas", CX: "Cathay Pacific", JL: "Japan Airlines", MH: "Malaysia Airlines",
  TG: "Thai Airways", CZ: "China Southern Airlines", MU: "China Eastern Airlines",
  CA: "Air China", FI: "Icelandair", TP: "TAP Air Portugal",
  TN: "Air Tahiti Nui", LO: "LOT Polish Airlines", EI: "Aer Lingus",
  BF: "French Bee", B6: "JetBlue", AS: "Alaska Airlines", KL: "KLM",
};

/**
 * Returns the real airline name for a value that may be either a full name
 * already or a bare 2-letter IATA code. Anything unrecognised is returned
 * untouched -- never replaced with a guess.
 */
export function airlineName(value: string | undefined | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (raw.length === 2) return AIRLINE_NAMES[raw.toUpperCase()] ?? raw;
  return raw;
}
