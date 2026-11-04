/**
 * Pausing flight APIs and recording their answers — SERVER ONLY (added 4 Nov 2026).
 *
 * A paused API has suppliers.status = 'inactive'. Only that value means paused:
 * 'historical' is an old label already on some rows, including APIs in live use.
 */
import { getRequest } from "@tanstack/react-start/server";

/** Every search reads this, so each running copy of the Worker keeps it this long. */
const PAUSED_CACHE_MS = 30_000;

let cached: { at: number; paused: Set<string> } | null = null;

/** The paused APIs. If they can't be read, nothing counts as paused, so search keeps working. */
export async function pausedProviders(): Promise<Set<string>> {
  if (cached && Date.now() - cached.at < PAUSED_CACHE_MS) return cached.paused;
  let paused = new Set<string>();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("suppliers").select("code").eq("status", "inactive");
    if (error) throw error;
    paused = new Set((data ?? []).map((row) => row.code));
  } catch (e) {
    console.warn("[providers] could not read paused APIs", e);
  }
  cached = { at: Date.now(), paused };
  return paused;
}

export function forgetPausedProviders(): void {
  cached = null;
}

/** Lets work finish after the customer's response has gone. Without this, Cloudflare cancels it. */
export function keepAlive(work: Promise<unknown>): void {
  try {
    (getRequest() as Request & { waitUntil?: (p: Promise<unknown>) => void }).waitUntil?.(work);
  } catch {
    /* outside a request, nothing would cancel the work */
  }
}

/** Never delays or fails a search. */
export function logProviderAnswer(entry: {
  supplier: string;
  fares: number;
  durationMs: number;
  error: string | null;
  origin: string;
  destination: string;
}): void {
  const write = (async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("provider_search_log").insert({
      supplier: entry.supplier,
      fares: entry.fares,
      duration_ms: entry.durationMs,
      error: entry.error?.slice(0, 300) ?? null,
      origin: entry.origin,
      destination: entry.destination,
    });
    if (error) throw error;
  })().catch((e) => console.warn("[providers] could not record an answer", e));
  keepAlive(write);
}
