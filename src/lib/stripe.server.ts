/**
 * Stripe REST calls — SERVER ONLY (added 3 Nov 2026).
 *
 * Plain fetch calls in the same style as the fare suppliers, instead of the stripe npm
 * package: the Worker's free plan allows 10 ms of CPU per request and the checkout only
 * needs these few calls.
 *
 * Card details never reach VootFly. The Payment Element on /flight/payment sends them
 * straight to Stripe, and this file only ever sees a PaymentIntent.
 * Docs: https://docs.stripe.com/api/payment_intents
 */
const BASE_URL = "https://api.stripe.com/v1";
const REQUEST_TIMEOUT_MS = 20_000;
const WEBHOOK_TOLERANCE_SECONDS = 300;

export type StripePaymentIntent = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  client_secret?: string | null;
  metadata?: Record<string, string>;
  /** An object only when requested with expand. Stripe never returns the full number or the CVC. */
  payment_method?:
    | string
    | {
        id: string;
        billing_details?: { name?: string | null };
        card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
      }
    | null;
  latest_charge?:
    | string
    | { receipt_url?: string | null; refunded?: boolean; payment_method_details?: { card?: { capture_before?: number | null } } | null }
    | null;
  last_payment_error?: { code?: string; decline_code?: string; message?: string } | null;
};

export class StripeError extends Error {
  constructor(
    message: string,
    /** Null when Stripe could not be reached at all, so the outcome of the call is unknown. */
    readonly status: number | null,
    readonly code?: string,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

/** Both keys, or null when card payment is not set up here. Checkout then stays a booking request. */
export function stripeKeys(): { secret: string; publishable: string } | null {
  const secret = process.env["STRIPE_SECRET_KEY"]?.trim();
  const publishable = process.env["STRIPE_PUBLISHABLE_KEY"]?.trim();
  return secret && publishable ? { secret, publishable } : null;
}

export function stripeIsTestMode(): boolean {
  return Boolean(stripeKeys()?.secret.startsWith("sk_test_"));
}

function formBody(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripeRequest<T>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string | number>,
  idempotencyKey?: string,
): Promise<T> {
  const keys = stripeKeys();
  if (!keys) throw new StripeError("Stripe keys are not configured", null);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${keys.secret}`,
        ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(params ? { body: formBody(params) } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[Stripe] transport failure", error);
    throw new StripeError("Could not reach Stripe", null);
  }

  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: string } }) | null;
  if (!res.ok || !body) {
    const message = body?.error?.message ?? `Stripe returned ${res.status}`;
    console.error(`[Stripe] ${method} ${path} failed (${res.status}): ${message}`);
    throw new StripeError(message, res.status, body?.error?.code);
  }
  return body;
}

/**
 * Places a hold on the card rather than charging it (manual capture). The money is only
 * taken once the sales team has issued the ticket; if they can't, the hold is released
 * and the customer is never charged.
 */
export function createPaymentIntent(input: {
  amountMinor: number;
  currency: string;
  description: string;
  receiptEmail: string;
  checkoutId: string;
  reference: string;
}): Promise<StripePaymentIntent> {
  return stripeRequest<StripePaymentIntent>(
    "POST",
    "/payment_intents",
    {
      amount: input.amountMinor,
      currency: input.currency.toLowerCase(),
      capture_method: "manual",
      "payment_method_types[0]": "card",
      description: input.description,
      receipt_email: input.receiptEmail,
      "metadata[checkout_id]": input.checkoutId,
      "metadata[reference]": input.reference,
    },
    `checkout-${input.checkoutId}`,
  );
}

export const retrievePaymentIntent = (id: string) =>
  stripeRequest<StripePaymentIntent>("GET", `/payment_intents/${encodeURIComponent(id)}?expand%5B%5D=payment_method&expand%5B%5D=latest_charge`);

/** The only card details VootFly keeps: enough for staff to recognise the card, useless for charging it. */
export function maskedCard(intent: StripePaymentIntent) {
  const method = intent.payment_method;
  if (!method || typeof method === "string" || !method.card) return {};
  return {
    stripe_payment_method_id: method.id,
    card_brand: method.card.brand ?? null,
    card_last4: method.card.last4 ?? null,
    card_exp_month: method.card.exp_month ?? null,
    card_exp_year: method.card.exp_year ?? null,
    cardholder_name: method.billing_details?.name ?? null,
  };
}

/** Stripe's own last moment to charge this hold. It varies by card network, so it is not worked out here. */
export function holdExpiresAt(intent: StripePaymentIntent): string | null {
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const seconds = charge?.payment_method_details?.card?.capture_before;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** Refunds the whole payment. The key means a double click or a retry can't refund twice. */
export const refundPaymentIntent = (id: string) =>
  stripeRequest<{ id: string; status: string }>("POST", "/refunds", { payment_intent: id }, `refund-${id}`);

export const capturePaymentIntent = (id: string) =>
  stripeRequest<StripePaymentIntent>("POST", `/payment_intents/${encodeURIComponent(id)}/capture`, {}, `capture-${id}`);

export const cancelPaymentIntent = (id: string) =>
  stripeRequest<StripePaymentIntent>("POST", `/payment_intents/${encodeURIComponent(id)}/cancel`, {}, `cancel-${id}`);

/** Currencies Stripe takes in whole units (https://docs.stripe.com/currencies#zero-decimal). */
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const THREE_DECIMAL = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

/**
 * "373.42" USD -> 37342. Works on the digits rather than through a float, so a supplier's
 * exact amount is never nudged by rounding. Null when the amount cannot be charged exactly.
 */
export function toMinorUnits(amount: string, currency: string): number | null {
  const code = currency.toUpperCase();
  if (THREE_DECIMAL.has(code)) return null;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) return null;
  const whole = m[1]!;
  const fraction = (m[2] ?? "").padEnd(2, "0");
  if (ZERO_DECIMAL.has(code)) return fraction === "00" ? Number(whole) : null;
  const minor = Number(`${whole}${fraction}`);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** Checks a webhook really came from Stripe: https://docs.stripe.com/webhooks#verify-manually */
export async function verifyWebhookSignature(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((candidate) => constantTimeEqual(candidate, expected));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
