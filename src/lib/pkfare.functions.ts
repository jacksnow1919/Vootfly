import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchSchema = z.object({
  origin: z.string().min(3).max(4),
  destination: z.string().min(3).max(4),
  departDate: z.string().min(8).max(10),
  returnDate: z.string().min(8).max(10).optional(),
  adults: z.number().int().min(1).max(9).optional(),
  children: z.number().int().min(0).max(9).optional(),
  infants: z.number().int().min(0).max(9).optional(),
  cabinClass: z.enum(["Economy", "PremiumEconomy", "Business", "First"]).optional(),
  currency: z.string().min(3).max(3).optional(),
  solutions: z.number().int().min(1).max(50).optional(),
  airline: z.string().max(3).optional(),
});

/**
 * PKFARE needs a real, specific airport code -- it doesn't accept the bare
 * multi-airport-metro codes (NYC, TYO, LON, CHI...) this app also uses for
 * routing/URLs. Sending it "NYC" directly returned zero fares for every
 * multi-airport-metro route once the route-page links started using metro
 * codes (found 2026-09-09, right after that fix shipped -- PKFARE's "no
 * fares for this route/date" for New York-Tokyo, a route that obviously
 * has real fares, was the tell). Resolves to the metro's first child
 * airport when the given code is a multi-airport metro with no IATA of
 * its own; passes anything else through unchanged.
 */
async function resolveSearchCode(code: string): Promise<string> {
  const upper = code.toUpperCase();
  const { loadPlaces } = await import("./seo-pages.functions");
  const places = await loadPlaces();
  const place = places[upper.toLowerCase()];
  if (!place || place.iata) return upper;
  if (place.level !== "metro" || place.single_airport) return upper;
  const child = Object.values(places).find(
    (p) => p.parent_code === place.code && p.level === "airport" && p.iata,
  );
  return child?.iata ?? upper;
}

/** Searches live PKFARE inventory on the server; credentials stay server-side. */
export const searchPkfare = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }) => {
    const { runPkfareSearch } = await import("./pkfare.server");
    const [origin, destination] = await Promise.all([
      resolveSearchCode(data.origin),
      resolveSearchCode(data.destination),
    ]);
    return runPkfareSearch({ ...data, origin, destination });
  });
