import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const postbackInput = z.object({
  clickId: z.string().min(1).max(160),
  pnr: z.string().min(3).max(32),
  amount: z.number().nonnegative(),
  currency: z.string().min(3).max(6).optional(),
  route: z.string().max(64).optional(),
});

const DEFAULT_WEBHOOK_URL = "https://eazair.com/api/webhooks/booking";
const PARTNER_SLUG = "vootfly";

/**
 * Fires the affiliate postback to EAZAIR. Never throws to the caller —
 * checkout confirmation must not depend on the partner being reachable.
 */
export const notifyEazairWebhook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => postbackInput.parse(data))
  .handler(async ({ data }) => {
    const url = process.env["EAZAIR_WEBHOOK_URL"] || DEFAULT_WEBHOOK_URL;
    const secret = process.env["PARTNER_POSTBACK_SECRET"];

    const payload = {
      click_id: data.clickId,
      partner_slug: PARTNER_SLUG,
      pnr: data.pnr,
      amount: data.amount,
      currency: (data.currency ?? "USD").toUpperCase(),
      route: data.route ?? "", // "ORIGIN-DESTINATION" (hyphen, no spaces) matches the proven Business Class Deal format
      status: "pending" as const,
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { authorization: `Bearer ${secret}`, "x-partner-secret": secret } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error("[notifyEazairWebhook] partner rejected postback", res.status, await res.text());
        return { sent: false as const, reason: "rejected" as const, status: res.status };
      }
      return { sent: true as const };
    } catch (error) {
      console.error("[notifyEazairWebhook] postback failed", error);
      return { sent: false as const, reason: "network_error" as const };
    }
  });
