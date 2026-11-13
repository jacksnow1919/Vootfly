/**
 * Stored-text guard for strict route pages (content_json.template === 2, added
 * 13 Nov 2026).
 *
 * Prices, flight times and frequencies change; text saved in seo_pages does not.
 * Eleven of the twelve September route pages contradicted themselves because
 * their stored intro and FAQs quoted fares that the live fare box had since
 * replaced. On a strict page every number a traveller sees comes from the live
 * fare snapshot at render time, so the stored copy may hold none.
 *
 * Pure function, no imports: used by upsertPages before a strict page is saved
 * and by the page's own test.
 */

export type GuardViolation = { field: string; match: string; reason: string };

/**
 * Verified route facts (14 Nov 2026). A stored section or FAQ may state a route fact
 * (who flies nonstop, which terminal) only when it carries the official sources it was
 * checked against and the date of that check. Such an item is exempt from the number
 * and nonstop rules below; the page shows its check date and sources, and hides it once
 * the check is older than VERIFIED_FACT_MAX_AGE_DAYS so a stale fact is never shown.
 */
export type VerifiedMeta = { checked_at: string; sources: { label: string; url: string }[] };

export const VERIFIED_FACT_MAX_AGE_DAYS = 180;

/** True when an item's `verified` block names a real check date and at least one https source. */
export function hasValidVerification(item: unknown): item is { verified: VerifiedMeta } {
  const v = (item as { verified?: Partial<VerifiedMeta> } | null)?.verified;
  if (!v || typeof v !== "object") return false;
  const date =
    typeof v.checked_at === "string" ? Date.parse(`${v.checked_at.slice(0, 10)}T00:00:00Z`) : NaN;
  const sources = Array.isArray(v.sources) ? v.sources : [];
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(String(v.checked_at)) &&
    Number.isFinite(date) &&
    sources.length > 0 &&
    sources.every(
      (s) =>
        !!s &&
        typeof s.label === "string" &&
        s.label.trim() !== "" &&
        /^https:\/\/\S+$/.test(String(s.url)),
    )
  );
}

/** A verified fact is shown only while its check is recent enough. */
export function verifiedFactIsCurrent(item: { verified: VerifiedMeta }, now = Date.now()): boolean {
  const t = Date.parse(`${item.verified.checked_at}T00:00:00Z`);
  return Number.isFinite(t) && t <= now && now - t < VERIFIED_FACT_MAX_AGE_DAYS * 86_400_000;
}

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|dozen|half|single|double|twice";
const UNITS =
  "hours?|hrs?|minutes?|mins?|days?|nights?|weeks?|months?|flights?|stops?|times?|dollars?|pounds?|euros?|airlines?|airports?|terminals?|seats?|bags?|travell?ers?|passengers?|adults?|miles?|kilomet(?:er|re)s?|km|percent";

const RULES: { re: RegExp; reason: string }[] = [
  {
    re: /\d/g,
    reason: "digit (prices, dates, durations and counts must come from the live fare data)",
  },
  { re: /[$£€¥₹]/g, reason: "currency symbol" },
  { re: /\b(?:USD|GBP|EUR|CAD|INR)\b/g, reason: "currency code" },
  {
    re: new RegExp(`\\b(?:${NUMBER_WORDS})[\\s-]+(?:${UNITS})\\b`, "gi"),
    reason: "spelled-out quantity",
  },
  {
    re: /\b(?:daily|weekly|nightly|per day|a day|per week|a week|times a)\b/gi,
    reason: "frequency claim",
  },
  {
    re: /\bnon-?stops?\b/gi,
    reason: "nonstop claim (only verified route facts may say who flies nonstop)",
  },
];

function strings(
  value: unknown,
  path: string,
  out: { path: string; text: string }[],
  bad: GuardViolation[],
) {
  if (typeof value === "string") out.push({ path, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}[${i}]`, out, bad));
  else if (value && typeof value === "object") {
    if ("verified" in value) {
      // A verified fact is exempt only when its sources and check date are complete.
      // Otherwise it is flagged AND its text is checked like any other copy.
      if (hasValidVerification(value)) return;
      bad.push({
        field: path,
        match: "verified",
        reason: "verified fact without a check date and https sources",
      });
    }
    for (const [k, v] of Object.entries(value)) {
      // Source URLs and the template marker are not reader-facing copy.
      if (k === "url" || k === "template") continue;
      strings(v, path ? `${path}.${k}` : k, out, bad);
    }
  }
}

/** Every rule broken by the stored copy of a strict route page; empty when clean. */
export function findStoredTextViolations(page: {
  meta_title?: string | null | undefined;
  meta_description?: string | null | undefined;
  content_json?: unknown;
}): GuardViolation[] {
  const texts: { path: string; text: string }[] = [];
  if (page.meta_title) texts.push({ path: "meta_title", text: page.meta_title });
  if (page.meta_description) texts.push({ path: "meta_description", text: page.meta_description });
  const out: GuardViolation[] = [];
  strings(page.content_json, "content_json", texts, out);
  for (const { path, text } of texts) {
    for (const { re, reason } of RULES) {
      for (const m of text.matchAll(new RegExp(re.source, re.flags)))
        out.push({ field: path, match: m[0], reason });
    }
  }
  return out;
}

/** True when content_json opts the page into the strict template. */
export function isStrictTemplate(content: unknown): boolean {
  return (
    !!content && typeof content === "object" && (content as { template?: unknown }).template === 2
  );
}
