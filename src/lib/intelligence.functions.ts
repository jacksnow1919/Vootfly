/**
 * Admin-only verification surface for the Phase 3 Travel Intelligence
 * services. These are thin, authenticated pass-throughs -- each one
 * checks the same operator session used by the rest of the admin area
 * (currentOperator(), unchanged) and then calls the REAL service function
 * directly. No intelligence logic is duplicated here; if a report's shape
 * or computation ever changes, it changes in exactly one place (the
 * service file), not two.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FORBIDDEN = { ok: false as const, error: "forbidden" as const };

export const adminGetFareIntelligence = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ fromCode: z.string().min(1).max(10), toCode: z.string().min(1).max(10), cabin: z.string().min(1).max(20) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    if (!(await currentOperator())) return FORBIDDEN;
    const { getFareIntelligence } = await import("@/lib/fare-intelligence.server");
    return { ok: true as const, report: await getFareIntelligence(data.fromCode, data.toCode, data.cabin) };
  });

export const adminGetRouteIntelligence = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ fromCode: z.string().min(1).max(10), toCode: z.string().min(1).max(10) }).parse(data))
  .handler(async ({ data }) => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    if (!(await currentOperator())) return FORBIDDEN;
    const { getRouteIntelligence } = await import("@/lib/route-intelligence.server");
    return { ok: true as const, report: await getRouteIntelligence(data.fromCode, data.toCode) };
  });

export const adminGetAirlineIntelligence = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ iataCode: z.string().min(1).max(3) }).parse(data))
  .handler(async ({ data }) => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    if (!(await currentOperator())) return FORBIDDEN;
    const { getAirlineIntelligence } = await import("@/lib/airline-intelligence.server");
    return { ok: true as const, report: await getAirlineIntelligence(data.iataCode) };
  });

export const adminGetAirportIntelligence = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().min(1).max(10) }).parse(data))
  .handler(async ({ data }) => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    if (!(await currentOperator())) return FORBIDDEN;
    const { getAirportIntelligence } = await import("@/lib/airport-intelligence.server");
    return { ok: true as const, report: await getAirportIntelligence(data.code) };
  });

export const adminGetDestinationIntelligence = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().min(1).max(10) }).parse(data))
  .handler(async ({ data }) => {
    const { currentOperator } = await import("@/lib/admin-session.server");
    if (!(await currentOperator())) return FORBIDDEN;
    const { getDestinationIntelligence } = await import("@/lib/destination-intelligence.server");
    return { ok: true as const, report: await getDestinationIntelligence(data.code) };
  });
