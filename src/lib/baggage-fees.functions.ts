/**
 * Real checked-bag fees, sourced monthly from each airline's own official
 * page only -- matching EazAir's proven pattern (their own agent reads
 * each airline's real site, holds back any figure that looks wrong, e.g.
 * their Southwest misread, and never publishes an unverified guess).
 *
 * PKFARE does not reliably supply baggage data, so this was previously
 * always "unknown" (comparison-engine.ts). This closes that gap only for
 * airlines with a real, dated, source-linked fee on file -- every other
 * airline still correctly shows nothing rather than a guess.
 */
import { createServerFn } from "@tanstack/react-start";

export type BaggageFee = { amount: number; currency: string; note: string | null; checkedAt: string };

/** Real fees for the given IATA codes, keyed by code. Airlines with no
 * real fee on file (or held for review) are simply absent from the result --
 * callers must never fill that gap with an assumption. */
export const getBaggageFees = createServerFn({ method: "GET" }).handler(async (): Promise<Record<string, BaggageFee>> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("airline_baggage_fees")
    .select("airline_iata, checked_bag_1_fee, checked_bag_1_currency, checked_bag_1_note, checked_at")
    .eq("cabin", "economy")
    .eq("needs_review", false)
    .not("checked_bag_1_fee", "is", null);

  const out: Record<string, BaggageFee> = {};
  for (const r of data ?? []) {
    if (r.checked_bag_1_fee == null) continue;
    out[r.airline_iata] = {
      amount: Number(r.checked_bag_1_fee),
      currency: r.checked_bag_1_currency ?? "USD",
      note: r.checked_bag_1_note,
      checkedAt: r.checked_at,
    };
  }
  return out;
});
