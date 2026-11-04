/**
 * Basis Theory card vault — SERVER ONLY.
 *
 * Card numbers never reach VootFly. The customer types into Basis Theory's own fields, and
 * this site only ever holds a token id plus the masked details below. Staff see the full
 * number in Basis Theory's fields too, through a short session allowed for one token only.
 *
 * Three keys, kept apart on purpose:
 *   BASIS_THEORY_PUBLIC_KEY  Browser. Can only create tokens.
 *   BASIS_THEORY_READ_KEY    Server. Mask access: masked details, and deleting a token.
 *   BASIS_THEORY_REVEAL_KEY  Server. Only used to authorise a reveal session, never to read.
 *
 * The vault stores cards and takes no money. The team charges through the airline or
 * consolidator when ticketing.
 * Docs: https://developers.basistheory.com/docs/guides/share/reveal-tokenized-data
 */
const BASE_URL = "https://api.basistheory.com";
const TIMEOUT_MS = 10_000;

const env = (name: string) => process.env[name]?.trim() ?? "";

export type VaultConfig = {
  publicKey: string;
  environment: "test" | "production";
  /** Only then do all customers see the card form. Otherwise it needs the test link. */
  live: boolean;
};

/** Null until every key is set, and the site then behaves exactly as it does without a vault. */
export function vaultConfig(): VaultConfig | null {
  const publicKey = env("BASIS_THEORY_PUBLIC_KEY");
  if (!publicKey || !env("BASIS_THEORY_READ_KEY") || !env("BASIS_THEORY_REVEAL_KEY")) return null;
  const environment = env("BASIS_THEORY_ENV") === "production" ? "production" : "test";
  return { publicKey, environment, live: environment === "production" && env("CARD_VAULT_LIVE") === "true" };
}

export type MaskedCard = { brand: string | null; last4: string; expMonth: number | null; expYear: number | null };

/** Masked details as the vault records them, so nothing the browser claims gets saved. */
export async function readMaskedCard(tokenId: string): Promise<MaskedCard | null> {
  const res = await fetch(`${BASE_URL}/tokens/${encodeURIComponent(tokenId)}`, {
    headers: { "BT-API-KEY": env("BASIS_THEORY_READ_KEY") },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // Only the status: a token's body is never logged.
    console.error(`[vault] reading a token failed (${res.status})`);
    return null;
  }
  const token = (await res.json().catch(() => null)) as {
    type?: string;
    card?: { last4?: string; brand?: string | null; expiration_month?: number; expiration_year?: number };
  } | null;
  const last4 = token?.card?.last4;
  if (token?.type !== "card" || !last4 || !/^\d{4}$/.test(last4)) return null;
  return {
    brand: token.card?.brand ?? null,
    last4,
    expMonth: token.card?.expiration_month ?? null,
    expYear: token.card?.expiration_year ?? null,
  };
}

/** Lets one browser session read one token. The session ends by itself within minutes. */
export async function authorizeRevealSession(nonce: string, tokenId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/sessions/authorize`, {
    method: "POST",
    headers: { "BT-API-KEY": env("BASIS_THEORY_REVEAL_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({
      nonce,
      rules: [
        {
          description: "Reveal one card for ticketing",
          priority: 1,
          conditions: [{ attribute: "id", operator: "equals", value: tokenId }],
          permissions: ["token:read", "token:use"],
          transform: "reveal",
        },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) console.error(`[vault] authorising a reveal failed (${res.status})`);
  return res.ok;
}

export async function deleteVaultToken(tokenId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/tokens/${encodeURIComponent(tokenId)}`, {
    method: "DELETE",
    headers: { "BT-API-KEY": env("BASIS_THEORY_READ_KEY") },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok && res.status !== 404) console.error(`[vault] deleting a token failed (${res.status})`);
  return res.ok || res.status === 404;
}
