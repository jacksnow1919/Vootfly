/**
 * Which live fare providers the site uses. SERVER ONLY.
 *
 * 31 Oct 2026: PKFARE's server is down, so every fare task (live search, fare re-check
 * before booking, route page fare snapshots, the EazAir supplier endpoint) uses Duffel.
 * 1 Nov 2026: MContent added as a second live supplier. When both Duffel and MContent are
 * configured, every search asks both at once and uses whichever returns real fares first
 * (owner's instruction); if one fails or finds nothing, the other's fares are used.
 *
 * Project secret FARE_PROVIDER can force one supplier: "duffel", "mcontent" or "pkfare".
 * The PKFARE integration is kept intact for that.
 */
import type { FareSupplier } from "./pkfare-types";
export type FareProvider = FareSupplier;

const DUFFEL_SECRET_NAMES = ["DUFFEL_API_TOKEN", "DUFFEL_ACCESS_TOKEN", "DUFFEL_SECRET_KEY", "DUFFEL_API_KEY", "DUFFEL_TOKEN"];

/** The Duffel key from whichever of the usual secret names it was saved under. */
export function duffelToken(): string | null {
  for (const name of DUFFEL_SECRET_NAMES) {
    const v = process.env[name];
    if (v && v.trim()) return v.trim();
  }
  return null;
}

/** MContent credentials: MContent_ID is the site id, MContent_Source the source string. */
export function mcontentCredentials(): { siteId: string; source: string } | null {
  const pick = (...names: string[]) => {
    for (const n of names) {
      const v = process.env[n];
      if (v && v.trim()) return v.trim();
    }
    return "";
  };
  const siteId = pick("MContent_ID", "MCONTENT_ID", "MContent_SiteId", "MCONTENT_SITE_ID");
  const source = pick("MContent_Source", "MCONTENT_SOURCE");
  return siteId && source ? { siteId, source } : null;
}

export function pkfareConfigured(): boolean {
  return Boolean(process.env["PKFARE_PARTNER_ID"]?.trim() && process.env["PKFARE_PARTNER_KEY"]?.trim());
}

/** Suppliers to ask for a normal search, in order of preference for labels. */
export function liveFareProviders(): FareProvider[] {
  const forced = (process.env["FARE_PROVIDER"] ?? "").trim().toLowerCase();
  if (forced === "pkfare" || forced === "duffel" || forced === "mcontent") return [forced];
  const list: FareProvider[] = [];
  if (duffelToken()) list.push("duffel");
  if (mcontentCredentials()) list.push("mcontent");
  if (pkfareConfigured()) list.push("pkfare");
  return list.length ? list : ["pkfare"];
}

/**
 * Fallback label when no fare carries its own supplier tag. Prefer the fare's own
 * `supplier` field wherever a fare is at hand.
 */
export function activeFareProvider(): FareProvider {
  return liveFareProviders()[0]!;
}
