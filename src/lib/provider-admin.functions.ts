import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PROVIDERS = [
  { code: "pkfare", name: "PKFARE" },
  { code: "duffel", name: "Duffel" },
  { code: "mcontent", name: "MContent" },
] as const;

const HISTORY_DAYS_KEPT = 30;

export type FlightApiCard = {
  code: string;
  name: string;
  paused: boolean;
  hasKey: boolean;
  searches: number;
  searchesWithFares: number;
  fares: number;
  errors: number;
  averageMs: number | null;
  lastFaresAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

export type FlightApiSearch = {
  id: string;
  supplier: string;
  route: string;
  fares: number;
  durationMs: number;
  error: string | null;
  createdAt: string;
};

export type FlightApisResult =
  | { authorized: false }
  | { authorized: true; canControl: boolean; historyReady: boolean; cards: FlightApiCard[]; latest: FlightApiSearch[] };

/** Status, key presence and history for the admin tab. Key values never leave the server. */
export const getFlightApis = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ hours: z.union([z.literal(24), z.literal(168), z.literal(720)]) }).parse(data))
  .handler(async ({ data }): Promise<FlightApisResult> => {
    const { canManageStaff, currentOperator } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op) return { authorized: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { duffelToken, mcontentCredentials, pkfareConfigured } = await import("@/lib/fare-provider.server");
    const hasKey: Record<string, boolean> = {
      pkfare: pkfareConfigured(),
      duffel: Boolean(duffelToken()),
      mcontent: Boolean(mcontentCredentials()),
    };

    const { data: suppliers, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .select("code, status")
      .in("code", PROVIDERS.map((p) => p.code));
    if (supplierError) throw new Error("Could not load the flight APIs.");

    const since = new Date(Date.now() - data.hours * 3_600_000).toISOString();
    const { data: rows, error: logError } = await supabaseAdmin
      .from("provider_search_log")
      .select("id, supplier, fares, duration_ms, error, origin, destination, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (logError) console.warn("[flight apis] history unavailable", logError.message);
    const log = rows ?? [];

    const cards = PROVIDERS.map((p): FlightApiCard => {
      const own = log.filter((r) => r.supplier === p.code);
      const failed = own.filter((r) => r.error);
      const answered = own.filter((r) => !r.error);
      return {
        code: p.code,
        name: p.name,
        paused: suppliers?.find((s) => s.code === p.code)?.status === "inactive",
        hasKey: Boolean(hasKey[p.code]),
        searches: own.length,
        searchesWithFares: own.filter((r) => r.fares > 0).length,
        fares: own.reduce((sum, r) => sum + r.fares, 0),
        errors: failed.length,
        averageMs: answered.length
          ? Math.round(answered.reduce((sum, r) => sum + r.duration_ms, 0) / answered.length)
          : null,
        lastFaresAt: own.find((r) => r.fares > 0)?.created_at ?? null,
        lastError: failed[0]?.error ?? null,
        lastErrorAt: failed[0]?.created_at ?? null,
      };
    });

    // Keeps the table small on the free database plan.
    if (!logError) {
      const cutoff = new Date(Date.now() - HISTORY_DAYS_KEPT * 86_400_000).toISOString();
      await supabaseAdmin.from("provider_search_log").delete().lt("created_at", cutoff);
    }

    return {
      authorized: true,
      canControl: canManageStaff(op.role),
      historyReady: !logError,
      cards,
      latest: log.slice(0, 30).map((r) => ({
        id: r.id,
        supplier: r.supplier,
        route: `${r.origin ?? "?"} → ${r.destination ?? "?"}`,
        fares: r.fares,
        durationMs: r.duration_ms,
        error: r.error,
        createdAt: r.created_at,
      })),
    };
  });

/** Pause or resume one API. The key itself stays where it is. */
export const setFlightApiPaused = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ code: z.enum(["pkfare", "duffel", "mcontent"]), paused: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { canManageStaff, currentOperator } = await import("@/lib/admin-session.server");
    const op = await currentOperator();
    if (!op || !canManageStaff(op.role)) return { ok: false as const, reason: "forbidden" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const name = PROVIDERS.find((p) => p.code === data.code)!.name;
    const { error } = await supabaseAdmin.from("suppliers").upsert(
      { code: data.code, name, status: data.paused ? "inactive" : "active", updated_at: new Date().toISOString() },
      { onConflict: "code" },
    );
    if (error) {
      console.error("[flight apis] could not change status", error);
      throw new Error("Could not change this API.");
    }
    await supabaseAdmin.from("audit_logs").insert({
      operator_id: op.id,
      operator_name: op.name,
      operator_role: op.role,
      action: data.paused ? "FLIGHT_API_PAUSED" : "FLIGHT_API_RESUMED",
      remarks: name,
    });
    const { forgetPausedProviders } = await import("@/lib/provider-control.server");
    forgetPausedProviders();
    return { ok: true as const };
  });
