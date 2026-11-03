import { createServerFn } from "@tanstack/react-start";

/**
 * Real, live exchange rates from Frankfurter (api.frankfurter.dev) -- a
 * free, open-source, no-API-key service sourcing reference rates from the
 * European Central Bank and 93 other central banks. No account, no key,
 * explicitly fine for commercial use. Chosen after confirming PKFARE
 * itself won't quote fares in anything but USD (tested directly: a
 * currency field in the search request was silently ignored -- see
 * pkfare.server.ts). This is a DISPLAY conversion, not a native quote:
 * PKFARE always returns USD; this converts that real USD amount to the
 * visitor's chosen currency at today's real rate, and the UI must label
 * it as converted, never presented as if it were a native quote.
 */
export type ExchangeRates = {
  base: "USD";
  date: string;
  rates: Record<string, number>;
};

let rateCache: { at: number; data: ExchangeRates } | null = null;
const RATE_TTL_MS = 6 * 60 * 60 * 1000; // ECB updates once/day; 6h is plenty fresh without hammering the API

export const getExchangeRates = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExchangeRates> => {
    if (rateCache && Date.now() - rateCache.at < RATE_TTL_MS) return rateCache.data;
    // AbortController + setTimeout instead of AbortSignal.timeout(): the
    // latter has a documented Cloudflare workerd edge case (an uncatchable
    // async DOMException in some run modes -- cloudflare/workerd#1020).
    // Not confirmed to be the cause of the reported "currency isn't
    // working" bug, but removed defensively since this codepath needs to
    // be reliable and the safer pattern costs nothing.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD", {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`frankfurter ${res.status}`);
      const json = (await res.json()) as { base: string; date: string; rates: Record<string, number> };
      const data: ExchangeRates = { base: "USD", date: json.date, rates: { ...json.rates, USD: 1 } };
      rateCache = { at: Date.now(), data };
      return data;
    } catch (e) {
      console.warn("[currency] Frankfurter fetch failed, USD-only fallback", (e as Error).message);
      // Real USD amounts are still shown correctly; only the OTHER currency
      // options become unavailable until the next successful fetch -- never
      // fabricate a rate.
      return rateCache?.data ?? { base: "USD", date: "", rates: { USD: 1 } };
    } finally {
      clearTimeout(timeout);
    }
  },
);
