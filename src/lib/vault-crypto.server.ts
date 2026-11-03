/* Server-only cryptography for staff passwords.
   PBKDF2-SHA256 for operator passwords.
   (The card-vault AES-256-GCM encrypt/decrypt functions that used to live in
   this file were removed 2026-09-14 as part of a security cleanup -- the
   card_vault table they served has been empty since card collection was
   removed from the checkout flow on 2026-09-05, and nothing writes to it
   anymore. Kept the shared b64/unb64 helpers below since the password
   functions still use them.) */

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

const unb64 = (value: string) => {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
};

/* ------------------------------ passwords -------------------------------- */

// 100,000 is the maximum PBKDF2 iteration count Cloudflare Workers' WebCrypto accepts.
const ITERATIONS = 100_000;

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, salt, digest] = stored.split("$");
  if (scheme !== "pbkdf2" || !salt || !digest) return false;
  const count = Number(iterations);
  // A hash that can't be checked must count as a non-match, never crash sign-in.
  if (!Number.isFinite(count) || count <= 0 || count > 100_000) return false;
  try {
    const bits = await derive(password, unb64(salt), count);
    return timingSafeEqual(b64(bits), digest);
  } catch {
    return false;
  }
}

async function derive(password: string, salt: Uint8Array, iterations = ITERATIONS) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    base,
    256,
  );
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
