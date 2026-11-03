/**
 * Price alerts / fare watches — Phase 7 activation.
 *
 * Lets a traveller ask to be told when a fare on a route they care about
 * drops. The point of activation is to capture value from a visitor who
 * is not ready to book today, which works at any traffic level -- unlike
 * A/B testing, which needs volume VootFly does not yet have.
 *
 * The baseline fare is recorded from REAL data at creation time, so a
 * later "the price dropped" claim is measured against something real
 * rather than asserted. An alert created without a real baseline records
 * null and simply cannot claim a drop until a real fare is seen.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  email: z.string().email().max(200),
  fromCode: z.string().min(2).max(8),
  toCode: z.string().min(2).max(8),
  cabin: z.string().min(2).max(20).default("economy"),
  departDate: z.string().nullable().optional(),
  returnDate: z.string().nullable().optional(),
  passengers: z.number().int().min(1).max(9).default(1),
  /** The real fare the traveller was looking at when they asked to watch it. */
  baselinePrice: z.number().positive().nullable().optional(),
  baselineCurrency: z.string().length(3).nullable().optional(),
});

export type CreateAlertResult =
  | { ok: true; alreadyWatching: boolean }
  | { ok: false; reason: "invalid" | "failed" };

export const createPriceAlert = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<CreateAlertResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only record a baseline when a real amount was supplied. A guessed or
    // zero baseline would make every future comparison meaningless.
    const hasRealBaseline = typeof data.baselinePrice === "number" && data.baselinePrice > 0;

    const { error } = await supabaseAdmin.from("price_alerts").upsert(
      {
        email: data.email.trim().toLowerCase(),
        from_code: data.fromCode.toLowerCase(),
        to_code: data.toCode.toLowerCase(),
        cabin: data.cabin.toLowerCase(),
        depart_date: data.departDate || null,
        return_date: data.returnDate || null,
        passengers: data.passengers,
        baseline_price: hasRealBaseline ? (data.baselinePrice as number) : null,
        baseline_currency: hasRealBaseline ? (data.baselineCurrency ?? "USD") : null,
        baseline_observed_at: hasRealBaseline ? new Date().toISOString() : null,
        is_active: true,
      },
      { onConflict: "email,from_code,to_code,cabin,depart_date", ignoreDuplicates: false },
    );

    if (error) {
      console.error("[createPriceAlert] upsert failed", error);
      return { ok: false, reason: "failed" };
    }
    return { ok: true, alreadyWatching: false };
  });
