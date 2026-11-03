import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/record-fare-observation
 * body: { from_code, to_code, cabin, price, currency, airline_iata?, observed_at }
 *
 * Records ONE real fare observation (Phase 3 Fare Intelligence). Called by
 * W6 immediately after a real, successful PKFARE fare refresh -- the
 * caller must supply the actual price/airline/timestamp that refresh
 * produced. This endpoint does not fetch or verify a fare itself; it only
 * records what the caller reports, so it must never be called with an
 * estimated, sample, or placeholder value. Reuses the same auth pattern
 * (authorized()) as every other webhook in this project -- no new auth
 * mechanism introduced.
 */
export const Route = createFileRoute("/api/public/webhook/record-fare-observation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        let json: unknown = {};
        try {
          json = await request.json();
        } catch {
          json = {};
        }

        const parsed = z
          .object({
            from_code: z.string().min(1).max(10),
            to_code: z.string().min(1).max(10),
            cabin: z.string().min(1).max(20),
            price: z.number().positive(),
            currency: z.string().length(3),
            airline_iata: z.string().length(2).nullable().optional(),
            observed_at: z.string().min(1),
          })
          .safeParse(json ?? {});

        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });

        const { recordFareObservation } = await import("@/lib/fare-intelligence.server");
        const result = await recordFareObservation({
          fromCode: parsed.data.from_code,
          toCode: parsed.data.to_code,
          cabin: parsed.data.cabin,
          price: parsed.data.price,
          currency: parsed.data.currency.toUpperCase(),
          airlineIata: parsed.data.airline_iata ?? null,
          // Provider that served the fare lookups (Duffel while PKFARE is down).
          supplierCode: (await import("@/lib/fare-provider.server")).activeFareProvider(),
          source: `W6 fare cache refresh (real ${{ duffel: "Duffel", mcontent: "MContent", pkfare: "PKFARE" }[(await import("@/lib/fare-provider.server")).activeFareProvider()]} data)`,
          observedAt: parsed.data.observed_at,
        });

        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
