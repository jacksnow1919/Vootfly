import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { routePath, snapshotIsFresh, type Cabin, type PlaceMap, type Place, type FareSnapshot } from "@/lib/hierarchy";
import { findStoredTextViolations, isStrictTemplate } from "@/lib/route-content-guard";

export const QA_PUBLISH_THRESHOLD = 85;

/**
 * Daily publish cap. Must not be increased automatically -- this is a
 * production safety limit, changed only by deliberate, explicit edit here.
 * The system is designed to support raising it later (2, 5, 10/day), but
 * the current production value stays 1 until explicitly changed.
 */
export const MAX_PAGES_PER_DAY = 1;

/**
 * Timezone the daily publish window is measured in. A single named
 * constant here (like QA_PUBLISH_THRESHOLD above) so the schedule can be
 * changed later without restructuring anything -- edit this one line.
 */
export const PUBLISH_TIMEZONE = "America/New_York";

/** Start of "today" in PUBLISH_TIMEZONE, as a UTC ISO string, for querying published_at. */
function startOfPublishDayUtc(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PUBLISH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  // Midnight in PUBLISH_TIMEZONE, expressed as a UTC instant. Using the
  // Intl offset trick rather than a timezone library, since this only
  // needs one correct boundary per call, not general timezone math.
  const localMidnightGuessUtc = new Date(`${y}-${m}-${d}T00:00:00Z`);
  const offsetCheck = new Intl.DateTimeFormat("en-US", {
    timeZone: PUBLISH_TIMEZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(localMidnightGuessUtc);
  const offsetStr = offsetCheck.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const offsetMatch = /GMT([+-]\d+)(?::(\d+))?/.exec(offsetStr);
  const offsetHours = offsetMatch ? Number(offsetMatch[1]) : 0;
  const offsetMinutes = offsetMatch?.[2] ? Number(offsetMatch[2]) : 0;
  const offsetMs = (offsetHours * 60 + Math.sign(offsetHours || 1) * offsetMinutes) * 60_000;
  return new Date(localMidnightGuessUtc.getTime() - offsetMs).toISOString();
}

/**
 * How many pages have genuinely gone live today, in PUBLISH_TIMEZONE.
 * Counts by published_at, not created_at/updated_at -- created_at would
 * miss a page that sat pending for days before finally clearing QA, and
 * updated_at would incorrectly count routine fare refreshes on pages
 * that were already published (see applyFareSnapshot below, which is
 * deliberately NOT gated by the daily limit -- refreshing an existing
 * page's fare isn't "publishing a new page").
 */
export async function countPublishedToday(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("seo_pages")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .gte("published_at", startOfPublishDayUtc());
  return count ?? 0;
}

/** Shared-secret check for every /api/public/webhook/* handler (n8n only). */
export function authorized(request: Request): boolean {
  const secret = process.env["N8N_WEBHOOK_SECRET"];
  const provided = request.headers.get("x-webhook-secret") ?? "";
  return Boolean(secret) && provided === secret;
}

// Place codes are always lowercase (matches every loader's `.toLowerCase()` normalization
// and the URL convention across the site). This used to accept uppercase too, which is what
// let VootFly's places table get seeded with uppercase codes in the first place -- masking
// the real bug instead of catching it. Reverted to strict lowercase on 2026-09-04 after that
// caused every published route page to 404 until the seed data itself was fixed.
const code = z.string().min(2).max(8).regex(/^[a-z0-9-]+$/);
const cabin = z.enum(["economy", "business", "first"]).default("economy");

export const fareSnapshotSchema = z.object({
  lowest: z
    .object({
      amount: z.number().positive(),
      currency: z.string().length(3),
      airline: z.string().optional(),
      airline_code: z.string().optional(),
      depart_date: z.string().optional(),
      return_date: z.string().optional(),
    })
    .nullable(),
  fares: z
    .array(
      z.object({
        amount: z.number().positive(),
        currency: z.string().length(3),
        airline: z.string().optional(),
        airline_code: z.string().optional(),
        depart_date: z.string().optional(),
        return_date: z.string().optional(),
        stops: z.number().int().min(0).optional(),
        duration_minutes: z.number().int().positive().optional(),
        cabin: z.string().max(30).optional(),
        supplier: z.string().max(20).optional(),
        operated_by: z.array(z.string().min(2).max(3)).max(4).optional(),
      }),
    )
    .max(50)
    .optional(),
  by_month: z.array(z.object({ month: z.string(), lowest: z.number().positive(), currency: z.string().length(3) })).max(12).optional(),
  fetched_at: z.string().datetime(),
  source: z.enum(["pkfare", "duffel", "mcontent"]),
  // What the search was for (13 Nov 2026), so a page can say who a fare is for.
  adults: z.number().int().positive().optional(),
  trip: z.enum(["round_trip", "one_way"]).optional(),
  searched: z
    .object({ origin: z.string().min(3).max(4), destination: z.string().min(3).max(4) })
    .optional(),
});

export const pageUpsertSchema = z.object({
  page_type: z
    .enum(["route", "airline_route", "origin_hub", "destination_hub", "airline", "airline_sub", "airport", "airport_sub", "destination_guide", "deal", "guide", "compare", "theme"])
    .default("route"),
  from_code: code.optional(),
  to_code: code.optional(),
  cabin,
  airline_slug: z.string().max(60).regex(/^[a-z0-9-]+$/).optional(),
  facet: z.string().max(40).regex(/^[a-z0-9-]+$/).optional(),
  path: z.string().max(200).regex(/^\/[a-z0-9\-\/]*\/$/).optional(),
  meta_title: z.string().min(1).max(200).optional(),
  meta_description: z.string().max(400).optional(),
  content_json: z.record(z.string(), z.unknown()).optional(),
  qa_score: z.number().int().min(0).max(100).optional(),
  fare_snapshot: fareSnapshotSchema.optional(),
  /** Explicit override; otherwise the index gate decides. */
  status: z.enum(["pending", "published", "noindex", "expired"]).optional(),
  legacy_slug: z.string().max(200).optional(),
});
export type PageUpsert = z.infer<typeof pageUpsertSchema>;

export async function loadPlacesAdmin(): Promise<PlaceMap> {
  const { data } = await supabaseAdmin.from("places").select("*").limit(5000);
  const map: PlaceMap = {};
  for (const r of data ?? []) map[r.code] = r as Place;
  return map;
}

/**
 * Index gate (F1): published only when there is real content, a passing QA score,
 * and a fresh real fare (route-type pages). Guide-type pages need only content + QA.
 * The 3-inbound-links condition is enforced by the Judgment OS workflow, not here.
 */
export function evaluateStatus(input: {
  page_type: string;
  content_json: unknown;
  qa_score: number | null;
  fare_snapshot_at: string | null;
}): "pending" | "published" | "noindex" {
  const hasContent = input.content_json && typeof input.content_json === "object" && Object.keys(input.content_json as object).length > 0;
  if (!hasContent) return "pending";
  const qaOk = (input.qa_score ?? 0) >= QA_PUBLISH_THRESHOLD;
  const needsFare = ["route", "airline_route", "origin_hub", "destination_hub", "deal", "theme"].includes(input.page_type);
  const fareOk = !needsFare || snapshotIsFresh(input.fare_snapshot_at);
  return qaOk && fareOk ? "published" : "noindex";
}

function resolvePath(p: PageUpsert, places: PlaceMap): string | null {
  if (p.page_type === "route" && p.from_code && p.to_code) return routePath(places, p.from_code, p.to_code, p.cabin as Cabin);
  if (p.page_type === "airline_route" && p.airline_slug && p.from_code && p.to_code) return `/airlines/${p.airline_slug}/${p.from_code}/${p.to_code}/`;
  if (p.page_type === "origin_hub" && p.from_code) return `/flights-from/${p.from_code}/`;
  if (p.page_type === "destination_hub" && p.to_code) return `/flights-to/${p.to_code}/`;
  return p.path ?? null;
}

export async function upsertPages(items: PageUpsert[]) {
  const places = await loadPlacesAdmin();
  const results: { path: string | null; ok: boolean; status?: string; error?: string; note?: string }[] = [];
  for (const p of items) {
    if (p.from_code && !places[p.from_code]) {
      results.push({ path: null, ok: false, error: `unknown from_code ${p.from_code}` });
      continue;
    }
    if (p.to_code && !places[p.to_code]) {
      results.push({ path: null, ok: false, error: `unknown to_code ${p.to_code}` });
      continue;
    }
    const path = resolvePath(p, places);
    if (!path) {
      results.push({ path: null, ok: false, error: "could not resolve path (missing codes or path)" });
      continue;
    }
    const { data: existing } = await supabaseAdmin
      .from("seo_pages")
      .select("id, content_json, qa_score, fare_snapshot_at, status")
      .eq("path", path)
      .maybeSingle();

    const content_json = p.content_json ?? (existing?.content_json as Record<string, unknown> | undefined) ?? {};

    // Strict template pages (content_json.template === 2, 13 Nov 2026) may not store
    // prices, numbers or nonstop claims in their copy: every such figure must come
    // from the live fare snapshot at render time. Refuse the write rather than
    // save copy that will go stale. Other pages are not checked here.
    if (isStrictTemplate(content_json)) {
      const violations = findStoredTextViolations({
        meta_title: p.meta_title,
        meta_description: p.meta_description,
        content_json,
      });
      if (violations.length) {
        results.push({
          path,
          ok: false,
          error: `strict page copy holds ${violations.length} number or price claim(s): ${violations
            .slice(0, 5)
            .map((v) => `${v.field} "${v.match}" (${v.reason.split(" (")[0]})`)
            .join("; ")}`,
        });
        continue;
      }
    }

    const qa_score = p.qa_score ?? existing?.qa_score ?? null;
    const fare_snapshot_at = p.fare_snapshot?.fetched_at ?? existing?.fare_snapshot_at ?? null;
    let status = p.status ?? evaluateStatus({ page_type: p.page_type, content_json, qa_score, fare_snapshot_at });

    // Daily publish cap (MAX_PAGES_PER_DAY). Only gates a page that is
    // newly becoming published here -- a page that was already published
    // before this call (e.g. a routine fare refresh landing on the same
    // path) is exempt, since re-confirming an already-live page isn't
    // "publishing" against today's count. Held pages stay at whatever
    // status evaluateStatus would have given a fully-caught-up page
    // (pending/noindex), to be reconsidered on a later run -- same as the
    // spec's "leave remaining pages in QUEUED status".
    const isNewPublish = status === "published" && existing?.status !== "published";
    let dailyLimitHeld = false;
    if (isNewPublish) {
      const publishedToday = await countPublishedToday();
      if (publishedToday >= MAX_PAGES_PER_DAY) {
        status = "pending";
        dailyLimitHeld = true;
      }
    }

    const row: Database["public"]["Tables"]["seo_pages"]["Insert"] = {
      page_type: p.page_type,
      path,
      from_code: p.from_code ?? null,
      to_code: p.to_code ?? null,
      airline_slug: p.airline_slug ?? null,
      cabin: p.cabin,
      facet: p.facet ?? null,
      content_json: content_json as Json,
      qa_score,
      status,
    };
    if (isNewPublish && !dailyLimitHeld) row.published_at = new Date().toISOString();
    if (p.meta_title) row.meta_title = p.meta_title;
    if (p.meta_description) row.meta_description = p.meta_description;
    if (p.legacy_slug) row.legacy_slug = p.legacy_slug;
    if (p.fare_snapshot) {
      row.fare_snapshot_json = p.fare_snapshot as Json;
      row.fare_snapshot_at = fare_snapshot_at;

    }
    if (p.content_json) row.last_refreshed_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("seo_pages").upsert(row, { onConflict: "path" });
    if (!error && p.page_type === "route" && p.from_code && p.to_code) {
      await supabaseAdmin.from("route_candidates").update({ status: "promoted" }).eq("from_code", p.from_code).eq("to_code", p.to_code).eq("cabin", p.cabin).neq("status", "promoted");
    }
    results.push(
      error
        ? { path, ok: false, error: error.message }
        : { path, ok: true, status, ...(dailyLimitHeld ? { note: "MAX_PAGES_PER_DAY reached, held as pending" } : {}) },
    );
  }
  return results;
}

export const fareUpdateSchema = z.object({
  path: z.string().optional(),
  from_code: code.optional(),
  to_code: code.optional(),
  cabin,
  snapshot: fareSnapshotSchema,
});
export type FareUpdate = z.infer<typeof fareUpdateSchema>;

/** Write a real PKfare snapshot to the matching route page and re-run the index gate. */
export async function applyFareSnapshot(u: FareUpdate) {
  let q = supabaseAdmin.from("seo_pages").select("id, path, page_type, content_json, qa_score, status, fare_snapshot_json, from_code, to_code, cabin");
  if (u.path) q = q.eq("path", u.path);
  else if (u.from_code && u.to_code) q = q.eq("page_type", "route").eq("from_code", u.from_code).eq("to_code", u.to_code).eq("cabin", u.cabin);
  else return { ok: false, error: "path or from_code+to_code required" };
  const { data: page } = await q.maybeSingle();
  if (!page) return { ok: false, error: "page not found" };

  // Phase 3.1 (28 Sep 2026): hold back an impossible-looking fare. If a new
  // lowest price is below 0.4x or above 3x the route's usual price, the page
  // keeps its last good fare instead of publishing a likely data error.
  const newLowest = (u.snapshot as FareSnapshot).lowest?.amount;
  if (typeof newLowest === "number" && page.from_code && page.to_code) {
    const { checkSuspectFare } = await import("@/lib/fare-intelligence.server");
    const check = await checkSuspectFare(page.from_code, page.to_code, page.cabin ?? u.cabin ?? "economy", newLowest);
    if (check.suspect) {
      console.warn("[applyFareSnapshot] held back suspect fare", { path: page.path, newLowest, usual: check.usual });
      return { ok: false, heldBack: true, path: page.path,
        error: `held back: $${newLowest} is ${check.ratio?.toFixed(2)}x the usual $${check.usual} for this route` };
    }
  }
  // Status lock (14 Nov 2026): a fare refresh never changes a pending page's status.
  // Pending means the owner has not approved the page; before this, the first refresh
  // re-ran the publish gate on it, which would have published Miami to Paris and Seattle
  // to London (content and a QA score already in place) without approval and past the
  // daily limit, and made Dallas to London public as noindex. Publishing stays a
  // deliberate upsert with status "published".
  const status =
    page.status === "expired" || page.status === "pending"
      ? page.status
      : evaluateStatus({ page_type: page.page_type, content_json: page.content_json, qa_score: page.qa_score, fare_snapshot_at: u.snapshot.fetched_at });

  // Cost-conscious monthly-data preservation (2026-09-16). W6 refreshes with
  // months=0 deliberately -- 1 provider call per page instead of 4 -- to keep
  // the daily cache refresh cheap. That cheap payload carries no by_month, and
  // this function used to replace fare_snapshot_json wholesale, silently
  // destroying the monthly price breakdown route pages display. Six of nine
  // published pages had already lost it this way before this fix.
  //
  // Carrying it forward costs ZERO additional provider calls. It keeps its own
  // timestamp (by_month_fetched_at) so it is never presented as being as fresh
  // as the headline fare -- a cheap refresh updates today's price without
  // pretending the monthly trend was re-checked today.
  const existing = page.fare_snapshot_json as FareSnapshot | null;
  const incoming = u.snapshot as FareSnapshot;
  const merged: FareSnapshot = { ...incoming };
  if (incoming.by_month?.length) {
    merged.by_month_fetched_at = incoming.fetched_at;
  } else if (existing?.by_month?.length) {
    merged.by_month = existing.by_month;
    merged.by_month_fetched_at = existing.by_month_fetched_at ?? existing.fetched_at;
  }

  const { error } = await supabaseAdmin
    .from("seo_pages")
    .update({ fare_snapshot_json: merged as unknown as Json, fare_snapshot_at: u.snapshot.fetched_at, status })
    .eq("id", page.id);
  return error ? { ok: false, error: error.message } : { ok: true, path: page.path, status };
}

export const indexStatusSchema = z.object({
  path: z.string(),
  indexed_status: z.string().max(60),
  checked_at: z.string().datetime().optional(),
});

export async function applyIndexStatus(items: z.infer<typeof indexStatusSchema>[]) {
  const out: { path: string; ok: boolean }[] = [];
  for (const i of items) {
    const { error } = await supabaseAdmin
      .from("seo_pages")
      .update({ indexed_status: i.indexed_status, indexed_checked_at: i.checked_at ?? new Date().toISOString() })
      .eq("path", i.path);
    out.push({ path: i.path, ok: !error });
  }
  return out;
}

/** Work queues for n8n: what needs a fare refresh, what needs an index check, and route candidates not yet built. */
export type RefreshTier = "A" | "B" | "C";

/** Hours between refreshes per tier. A: top routes get a fresher fare more often; C: long tail costs less to run. */
const TIER_CADENCE_HOURS: Record<RefreshTier, number> = { A: 12, B: 48, C: 24 * 7 };

/** Share of each run's `limit` reserved per tier, so a burst of new Tier A pages can never fully starve B/C. */
const TIER_SHARE: Record<RefreshTier, number> = { A: 0.5, B: 0.3, C: 0.2 };

/**
 * Tier assignment: percentile rank of route_candidates.opportunity_score today (top 15% -> A,
 * next 35% -> B, rest -> C; a page with no scored candidate row defaults to C, not to a guess).
 *
 * SWAP THIS FUNCTION ONLY once pages have a few weeks of real GSC click/impression history --
 * real demonstrated interest beats predicted demand once it exists. Nothing else in the refresh
 * pipeline (cadences, batching, the queue endpoint contract) needs to change when that happens.
 */
async function assignRefreshTiers(): Promise<Map<string, RefreshTier>> {
  const { data: pages } = await supabaseAdmin
    .from("seo_pages")
    .select("path, from_code, to_code, cabin")
    .eq("page_type", "route")
    .neq("status", "expired")
    .limit(20000);
  const { data: candidates } = await supabaseAdmin.from("route_candidates").select("from_code, to_code, cabin, opportunity_score").limit(20000);
  const scoreMap = new Map((candidates ?? []).map((c) => [`${c.from_code}>${c.to_code}>${c.cabin}`, c.opportunity_score ?? 0]));

  const scored = (pages ?? []).map((p) => ({
    path: p.path,
    score: scoreMap.get(`${p.from_code}>${p.to_code}>${p.cabin}`) ?? 0,
  }));
  scored.sort((a, b) => b.score - a.score);

  const n = scored.length;
  const aCut = Math.ceil(n * 0.15);
  const bCut = aCut + Math.ceil(n * 0.35);
  const tiers = new Map<string, RefreshTier>();
  scored.forEach((s, i) => tiers.set(s.path, i < aCut ? "A" : i < bCut ? "B" : "C"));
  return tiers;
}

/**
 * Tiered, starvation-safe fare-refresh queue. Reuses the one proven pattern from EazAir's dormant
 * refresh-fares endpoint (stalest-relative-to-its-own-cadence first, hard per-run cap) but as three
 * independent buckets instead of one flat FIFO, so Tier C long-tail pages always get *some* coverage
 * even during a burst of new Tier A candidates.
 */
async function fareRefreshQueue(limit: number) {
  const tiers = await assignRefreshTiers();
  const { data } = await supabaseAdmin
    .from("seo_pages")
    .select("path, from_code, to_code, cabin, fare_snapshot_at, status")
    .eq("page_type", "route")
    .neq("status", "expired")
    .limit(20000);

  type Row = { path: string; from_code: string | null; to_code: string | null; cabin: string; fare_snapshot_at: string | null; status: string };
  const rows: Row[] = data ?? [];

  const now = Date.now();
  const buckets: Record<RefreshTier, { row: Row; overdueMs: number }[]> = { A: [], B: [], C: [] };
  for (const row of rows) {
    const tier = tiers.get(row.path) ?? "C";
    const cadenceMs = TIER_CADENCE_HOURS[tier] * 3600_000;
    const snapshotMs = row.fare_snapshot_at ? Date.parse(row.fare_snapshot_at) : 0; // never-snapshotted = maximally overdue
    const overdueMs = now - snapshotMs - cadenceMs;
    if (overdueMs >= 0) buckets[tier].push({ row, overdueMs });
  }
  (Object.keys(buckets) as RefreshTier[]).forEach((t) => buckets[t].sort((a, b) => b.overdueMs - a.overdueMs));

  const caps: Record<RefreshTier, number> = {
    A: Math.max(1, Math.round(limit * TIER_SHARE.A)),
    B: Math.max(1, Math.round(limit * TIER_SHARE.B)),
    C: Math.max(1, Math.round(limit * TIER_SHARE.C)),
  };
  const picked: { row: Row; tier: RefreshTier }[] = [];
  for (const t of ["A", "B", "C"] as RefreshTier[]) {
    for (const item of buckets[t].slice(0, caps[t])) picked.push({ row: item.row, tier: t });
  }
  return picked.map(({ row, tier }) => ({ ...row, refresh_tier: tier }));
}

export async function workQueue(kind: "fare-refresh" | "index-check" | "candidates" | "content" | "published-24h", limit: number) {
  if (kind === "content") {
    // Pages that have a real fare but no content yet (W1 input). Joined with place names so n8n needs no lookup.
    const places = await loadPlacesAdmin();
    const { data } = await supabaseAdmin
      .from("seo_pages")
      .select("path, page_type, from_code, to_code, cabin, fare_snapshot_json, fare_snapshot_at, qa_score, status")
      .eq("page_type", "route")
      .eq("content_json", "{}")
      .not("fare_snapshot_at", "is", null)
      .order("fare_snapshot_at", { ascending: false })
      .limit(limit);
    // Attach the real Keyword Planner queries (if scored) so W1 can target them when run from this queue.
    const keys = (data ?? []).filter((r) => r.from_code && r.to_code);
    const { data: cands } = keys.length
      ? await supabaseAdmin.from("route_candidates").select("from_code, to_code, cabin, keywords_json").in("from_code", keys.map((k) => k.from_code!)).in("to_code", keys.map((k) => k.to_code!))
      : { data: [] as { from_code: string; to_code: string; cabin: string; keywords_json: Json }[] };
    const kwMap = new Map((cands ?? []).map((c) => [`${c.from_code}>${c.to_code}>${c.cabin}`, c.keywords_json]));
    return (data ?? []).map((r) => ({
      ...r,
      keywords: kwMap.get(`${r.from_code}>${r.to_code}>${r.cabin}`) ?? [],
      from_name: r.from_code ? places[r.from_code]?.name ?? null : null,
      to_name: r.to_code ? places[r.to_code]?.name ?? null : null,
      from_iata: r.from_code ? places[r.from_code]?.iata ?? null : null,
      to_iata: r.to_code ? places[r.to_code]?.iata ?? null : null,
      to_country: r.to_code ? places[places[r.to_code]?.country_code ?? ""]?.name ?? null : null,
    }));
  }
  if (kind === "published-24h") {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await supabaseAdmin
      .from("seo_pages")
      .select("path, page_type, from_code, to_code, cabin, qa_score, fare_snapshot_json, updated_at")
      .eq("status", "published")
      .gte("last_refreshed_at", since)
      .order("updated_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  }
  if (kind === "fare-refresh") return fareRefreshQueue(limit);

  if (kind === "index-check") {
    const { data } = await supabaseAdmin
      .from("seo_pages")
      .select("path, indexed_status, indexed_checked_at")
      .eq("status", "published")
      .order("indexed_checked_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    return data ?? [];
  }
  // candidates: US gateway metros x destination metros that have no route page yet.
  // VootFly is economy-positioned (see hierarchy.ts's Cabin type notes) -- this used
  // to hardcode "business" here, which is what this fix is specifically correcting.
  const candidateCabin: Cabin = "economy";
  const places = await loadPlacesAdmin();
  const gateways = Object.values(places).filter((p) => p.level === "metro" && p.is_us_gateway);
  const dests = Object.values(places).filter((p) => p.level === "metro" && !p.is_us_gateway);
  const { data: existing } = await supabaseAdmin.from("seo_pages").select("from_code, to_code").eq("page_type", "route").eq("cabin", candidateCabin).limit(20000);
  const have = new Set((existing ?? []).map((e) => `${e.from_code}>${e.to_code}`));
  const out: { from_code: string; to_code: string; from_iata: string | null; to_iata: string | null; from_name: string; to_name: string; path: string }[] = [];
  for (const g of gateways) {
    for (const d of dests) {
      if (have.has(`${g.code}>${d.code}`)) continue;
      out.push({ from_code: g.code, to_code: d.code, from_iata: g.iata, to_iata: d.iata, from_name: g.name, to_name: d.name, path: routePath(places, g.code, d.code, candidateCabin)! });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fare lookup: real PKfare search for a route, normalised into a FareSnapshot.
// n8n calls this instead of holding PKfare credentials itself.
// ---------------------------------------------------------------------------
export const fareLookupSchema = z.object({
  from_code: code,
  to_code: code,
  cabin,
  /** ISO date; default = today + 45 days. */
  depart_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** ISO date; default = depart + 7 days. Pass null for one-way. */
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  /** Extra monthly probes for the "lowest by month" table (0-6, each is one more provider call). */
  months: z.number().int().min(0).max(6).default(0),
  /** Write the snapshot to the matching seo_pages row and re-run the index gate. */
  apply: z.boolean().default(false),
  /** 3-letter currency code to request from PKFARE. Defaults to USD. */
  currency: z.string().length(3).optional(),
});
export type FareLookup = z.infer<typeof fareLookupSchema>;

function isoPlusDays(base: Date, days: number): string {
  return new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** IATA codes to try for a place: the place itself, then (for multi-airport metros) its airports. */
function iataCandidates(places: PlaceMap, p: Place): string[] {
  const own = p.iata ? [p.iata] : [];
  if (p.level !== "metro" || p.single_airport) return own;
  const kids = Object.values(places).filter((k) => k.parent_code === p.code && k.level === "airport" && k.iata).map((k) => k.iata!);
  return [...own, ...kids.slice(0, 2)];
}

/**
 * Airlines that actually fly the outbound journey, when none of them is the airline
 * selling the fare (14 Nov 2026). A fare sold by Iberia on an American Airlines nonstop
 * is real, but labelled only "Iberia, nonstop" it reads as an Iberia nonstop; the page
 * shows "operated by" with it. Read from the supplier's own segment data, never guessed.
 */
function operatedBy(f: { carrierCode: string; segments?: { carrier: string; operating_carrier?: string }[] }) {
  const ops = [...new Set((f.segments ?? []).map((sg) => sg.operating_carrier ?? sg.carrier).filter(Boolean))];
  return ops.length && !ops.includes(f.carrierCode) ? { operated_by: ops } : {};
}

export async function lookupFareSnapshot(q: FareLookup) {
  const places = await loadPlacesAdmin();
  const from = places[q.from_code];
  const to = places[q.to_code];
  if (!from || !to) return { ok: false as const, error: "unknown from_code or to_code" };

  const { runAllSuppliers } = await import("@/lib/pkfare.server");
  // Map the page's cabin to PKFARE's cabin value.
  //
  // FIXED 2026-09-16. This line previously read:
  //   const cabinClass = q.cabin === "first" ? "First" : "Business";
  // which sent "Business" for EVERY non-first page, including every
  // economy page. It was the one place the site-wide Business -> Economy
  // migration missed, so every route page fare snapshot on the site was a
  // real business-class fare displayed under an economy-labelled page.
  //
  // Caught by comparing the two paths directly on the same route and dates
  // (New York to Tokyo, 27 Oct - 3 Nov): the live search, which correctly
  // sends "Economy", returned Asiana from $1,011 and an AA fare explicitly
  // marked ECONOMY at $1,374, while the route page snapshot showed $5,845
  // on the same airline. That ~5x gap was the bug, not provider noise --
  // and it explains the earlier evidence that prices did not fall when the
  // site "switched to economy": the snapshot path never switched at all.
  const cabinClass =
    q.cabin === "first" ? "First" : q.cabin === "business" ? "Business" : "Economy";
  const today = new Date();
  const depart = q.depart_date ?? isoPlusDays(today, 45);
  const ret = q.return_date === null ? undefined : (q.return_date ?? isoPlusDays(new Date(depart), 7));

  type Fare = Awaited<ReturnType<typeof runAllSuppliers>>[number];
  const search = async (o: string, d: string, departDate: string, returnDate?: string): Promise<Fare[]> => {
    // Fix B (14 Nov 2026): every live supplier is asked and waited for, and each keeps
    // up to 1,000 fares rather than its cheapest 40. Before this the fastest supplier
    // won and only its 40 cheapest fares were kept, which on Dallas to London left
    // nothing but one-stop fares although American and British Airways nonstops were
    // in both suppliers' answers (MContent's first nonstop was price rank 60).
    const params = { origin: o, destination: d, departDate, returnDate, cabinClass, adults: 1, solutions: 1000, currency: q.currency } as const;
    try {
      return await runAllSuppliers(params);
    } catch (e) {
      console.warn("[fare-lookup] PKFARE error", o, d, departDate, (e as Error).message);
      return [];
    }
  };

  // Metro code first (PKfare accepts IATA city codes); fall back to airport pairs only if empty.
  const fromCodes = iataCandidates(places, from);
  const toCodes = iataCandidates(places, to);
  let fares: Fare[] = [];
  let calls = 0;
  // The airport pair that actually returned the fares (13 Nov 2026), so a page can
  // name it. Recorded only when fares came back.
  let searched: { origin: string; destination: string } | undefined;
  outer: for (const o of fromCodes) {
    for (const d of toCodes) {
      fares = await search(o, d, depart, ret);
      calls++;
      if (fares.length) {
        searched = { origin: o, destination: d };
        break outer;
      }
      if (calls >= 4) break outer;
    }
  }

  // Monthly fare buckets. Fixed 2026-09-17: this previously advanced by
  // `30 * i` days from the departure date, which does NOT land on distinct
  // calendar months. Confirmed live on New York to Tokyo: a 1 Nov departure
  // produced 1 Dec, 31 Dec and 30 Jan -- labelled "Dec 2026", "Dec 2026"
  // and "Jan 2027", so the page showed December twice at two different
  // prices ($1,012 and $1,507) and silently lost a month of coverage.
  // Now advances by real calendar months, clamped to day 28 so it can
  // never skip a short month.
  const byMonth: { month: string; lowest: number; currency: string }[] = [];
  const baseDate = new Date(depart);
  for (let i = 1; i <= q.months; i++) {
    const d = new Date(
      Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + i, Math.min(baseDate.getUTCDate(), 28)),
    );
    const md = d.toISOString().slice(0, 10);
    const mr = ret ? isoPlusDays(new Date(md), 7) : undefined;
    const monthFares = await search(fromCodes[0]!, toCodes[0]!, md, mr);
    calls++;
    if (monthFares.length) {
      const low = monthFares.reduce((a, b) => (b.price < a.price ? b : a));
      byMonth.push({ month: d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }), lowest: low.price, currency: low.currency });
    }
  }

  const sorted = [...fares].sort((a, b) => a.price - b.price);
  const low = sorted[0];

  // Fare selection for display (fixed 2026-09-17). This used to be a flat
  // sorted.slice(0, 10) -- the 10 absolute cheapest solutions PKFARE
  // returned, with no regard for which airline they were on. On routes
  // where one carrier's fare-class ladder dominates the bottom of the
  // price range (confirmed live: New York to Tokyo's cheapest 10 were 8
  // identical Asiana Airlines solutions at $1,154 and 2 more Asiana at
  // $1,192), that produced a "Fare options" list that was the same row
  // repeated six times -- not fake data, but not a useful comparison
  // either, and it read as broken.
  //
  // Same real PKFARE solutions, better selection: take each airline's own
  // cheapest fare first (so real diversity surfaces when it exists), then
  // fill any remaining slots with the next-cheapest solutions overall,
  // skipping only exact duplicates (same airline + price + duration +
  // stops) of a fare already selected. A route where PKFARE genuinely only
  // returned one airline still correctly shows one airline -- this does
  // not invent carriers that were not in the results.
  //
  // 14 Nov 2026: the overall cheapest fare and each airline's cheapest NONSTOP fare are
  // taken first, so a nonstop that costs more than the cheapest one-stop fares is still
  // shown, then the fastest journey, then each airline's cheapest fare as before.
  const seenAirlines = new Set<string>();
  const selected: Fare[] = [];
  const take = (f: Fare | undefined) => {
    if (f && selected.length < 10 && !selected.includes(f)) selected.push(f);
  };
  take(low);
  const seenNonstop = new Set<string>();
  for (const f of sorted) {
    const key = f.carrierCode || f.airline;
    if (f.stops === 0 && key && !seenNonstop.has(key)) {
      seenNonstop.add(key);
      take(f);
    }
  }
  take([...fares].sort((a, b) => a.durationMinutes - b.durationMinutes || a.price - b.price)[0]);
  for (const f of selected) seenAirlines.add(f.carrierCode || f.airline);
  for (const f of sorted) {
    const key = f.carrierCode || f.airline;
    if (key && !seenAirlines.has(key)) {
      seenAirlines.add(key);
      take(f);
    }
    if (selected.length >= 10) break;
  }
  if (selected.length < 10) {
    const dupeKey = (f: Fare) => `${f.carrierCode || f.airline}|${f.price}|${f.durationMinutes}|${f.stops}`;
    const chosenKeys = new Set(selected.map(dupeKey));
    for (const f of sorted) {
      if (selected.length >= 10) break;
      const k = dupeKey(f);
      if (chosenKeys.has(k)) continue;
      chosenKeys.add(k);
      selected.push(f);
    }
  }
  selected.sort((a, b) => a.price - b.price);

  const snapshot = {
    lowest: low
      ? { amount: low.price, currency: low.currency, airline: low.airline, airline_code: low.carrierCode, depart_date: low.departDate, ...(ret ? { return_date: ret } : {}) }
      : null,
    fares: selected.map((f) => ({
      amount: f.price, currency: f.currency, airline: f.airline, airline_code: f.carrierCode,
      depart_date: f.departDate, ...(ret ? { return_date: ret } : {}), stops: f.stops, duration_minutes: f.durationMinutes,
      ...(f.cabin ? { cabin: f.cabin } : {}),
      ...(f.supplier ? { supplier: f.supplier } : {}),
      ...operatedBy(f),
    })),
    ...(byMonth.length ? { by_month: byMonth } : {}),
    fetched_at: new Date().toISOString(),
    // Which supplier really returned the headline fare (each fare carries its own tag
    // since Duffel and MContent are searched side by side, 1 Nov 2026).
    source: low?.supplier ?? (await import("@/lib/fare-provider.server")).activeFareProvider(),
    // What was searched (13 Nov 2026): the search above always asks for 1 adult.
    adults: 1,
    trip: ret ? ("round_trip" as const) : ("one_way" as const),
    ...(searched ? { searched } : {}),
  };

  let applied: Awaited<ReturnType<typeof applyFareSnapshot>> | null = null;
  if (q.apply && snapshot.lowest) {
    applied = await applyFareSnapshot({ from_code: q.from_code, to_code: q.to_code, cabin: q.cabin, snapshot });
  }
  return { ok: true as const, from: from.iata, to: to.iata, provider_calls: calls, result_count: fares.length, snapshot, applied };
}

// ---------------------------------------------------------------------------
// Keyword research (W2 "agent"): real Google Ads Keyword Planner metrics per candidate route.
// opportunityScore = round((searchVolume / (competitionIndex + 1)) * 100) / 100  (same formula as EazAir)
// ---------------------------------------------------------------------------
function placeTokens(p: Place): string[] {
  const t = new Set<string>();
  const name = p.name.toLowerCase();
  t.add(name);
  t.add(p.slug_name.replace(/-/g, " "));
  if (name.endsWith(" city")) t.add(name.slice(0, -5));
  if (p.iata) t.add(p.iata.toLowerCase());
  return [...t];
}

function seedKeywords(from: Place, to: Place, cabin: Cabin): string[] {
  // FIXED 2026-09-19. This previously read:
  //   const c = cabin === "first" ? "first class" : "business class";
  // so EVERY economy route was seeded with "business class" keywords -- the
  // same economy-migration miss that caused the fare-snapshot cabin bug.
  // VootFly was literally asking Google Keyword Planner for business-class
  // demand on pages positioned as economy, then scoring routes on the answer.
  const f = from.name.replace(/ City$/, "");
  const t = to.name;

  if (cabin === "first" || cabin === "business") {
    const c = cabin === "first" ? "first class" : "business class";
    const seeds = [
      `${c} flights ${f} to ${t}`,
      `${f} to ${t} ${c}`,
      `${c} ${f} to ${t}`,
      `${c} flights to ${t} from ${f}`,
    ];
    if (from.iata && to.iata) seeds.push(`${from.iata} to ${to.iata} ${c}`);
    return seeds;
  }

  // Economy: seed the way real travellers actually search a mass-market route.
  // "cheap flights X to Y" is the highest-intent phrasing on this kind of
  // route, so it is used as a SEED (what we ask Google about) even though
  // "cheap" stays banned in published copy -- those are different things.
  const seeds = [
    `flights ${f} to ${t}`,
    `${f} to ${t} flights`,
    `cheap flights ${f} to ${t}`,
    `${f} to ${t} airfare`,
    `book flights ${f} to ${t}`,
  ];
  if (from.iata && to.iata) seeds.push(`${from.iata} to ${to.iata} flights`);
  return seeds;
}

/** Make sure every gateway x destination pair has a candidate row (cheap idempotent upsert). */
async function ensureCandidateRows(cabin: Cabin) {
  const places = await loadPlacesAdmin();
  const gateways = Object.values(places).filter((p) => p.level === "metro" && p.is_us_gateway).sort((a, b) => a.sort_order - b.sort_order);
  const dests = Object.values(places).filter((p) => p.level === "metro" && !p.is_us_gateway).sort((a, b) => a.sort_order - b.sort_order);
  const rows: { from_code: string; to_code: string; cabin: string }[] = [];
  for (const g of gateways) for (const d of dests) rows.push({ from_code: g.code, to_code: d.code, cabin });
  // Surface upsert failures instead of swallowing them. This silently
  // returned "success" with zero rows for every economy run, because
  // route_candidates.cabin still carried a CHECK constraint allowing only
  // 'business' and 'first' -- the economy migration missed it, the same way
  // it missed the fare-snapshot cabinClass line and the keyword seeding.
  // scoreCandidates then reported ok:true, scored:0 and looked like there
  // was simply no work to do. A thrown error is far better than a clean
  // report of nothing happening.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin
      .from("route_candidates")
      .upsert(rows.slice(i, i + 500), { onConflict: "from_code,to_code,cabin", ignoreDuplicates: true });
    if (error) {
      console.error("[ensureCandidateRows] upsert failed", error);
      throw new Error(`Could not create route candidates (cabin=${cabin}): ${error.message}`);
    }
  }
  return places;
}

export async function scoreCandidates(limit: number, cabin: Cabin = "economy") {
  const { googleAdsConfigured, keywordIdeas } = await import("@/lib/google-ads.server");
  if (!googleAdsConfigured()) return { ok: false as const, error: "Google Ads secrets not configured on this project (GOOGLE_ADS_*)." };
  const places = await ensureCandidateRows(cabin);
  const { data: todo } = await supabaseAdmin
    .from("route_candidates")
    .select("id, from_code, to_code, cabin")
    .eq("cabin", cabin)
    .eq("status", "unscored")
    .order("created_at", { ascending: true })
    .limit(limit);

  const results: { from_code: string; to_code: string; ok: boolean; search_volume?: number; competition_index?: number; opportunity_score?: number; error?: string }[] = [];
  for (const c of todo ?? []) {
    const from = places[c.from_code];
    const to = places[c.to_code];
    if (!from || !to) continue;
    try {
      const ideas = await keywordIdeas(seedKeywords(from, to, cabin));
      const ft = placeTokens(from);
      const tt = placeTokens(to);
      // FIXED 2026-09-19. The cabin filter previously required every matched
      // keyword to contain "business class" / "premium" for ANY non-first
      // cabin, including economy -- so an economy route matched almost no
      // keywords, scored ~0 volume, and the whole opportunity ranking was
      // effectively dead for VootFly's actual positioning.
      //
      // Economy now REJECTS premium-cabin keywords instead of requiring them,
      // so a route is scored on genuine mass-market demand.
      const premiumWords = ["business class", "business-class", "first class", "first-class", "premium economy"];
      const matched = ideas
        .filter((k) => {
          const kw = k.keyword.toLowerCase();
          if (!ft.some((x) => kw.includes(x)) || !tt.some((x) => kw.includes(x))) return false;
          if (cabin === "first") return kw.includes("first class") || kw.includes("first-class");
          if (cabin === "business") return kw.includes("business class") || kw.includes("business-class");
          return !premiumWords.some((x) => kw.includes(x)); // economy: exclude premium intent
        })
        .sort((a, b) => b.avg_monthly_searches - a.avg_monthly_searches)
        .slice(0, 30);

      const volume = matched.reduce((s, k) => s + k.avg_monthly_searches, 0);
      const compIdx = volume > 0 ? matched.reduce((s, k) => s + k.competition_index * k.avg_monthly_searches, 0) / volume : matched.length ? matched.reduce((s, k) => s + k.competition_index, 0) / matched.length : 0;

      // Commercial intent, from real Keyword Planner top-of-page bid data.
      // Advertisers only bid high on keywords that convert, so this is the
      // best proxy Keyword Planner gives for "will this route actually
      // produce bookings" rather than just traffic. Volume-weighted, and
      // only over keywords that genuinely reported a bid.
      const withBid = matched.filter((k) => typeof k.high_top_of_page_bid_usd === "number" && k.high_top_of_page_bid_usd > 0);
      const bidVolume = withBid.reduce((s, k) => s + k.avg_monthly_searches, 0);
      const avgBid =
        bidVolume > 0
          ? withBid.reduce((s, k) => s + (k.high_top_of_page_bid_usd as number) * k.avg_monthly_searches, 0) / bidVolume
          : withBid.length
            ? withBid.reduce((s, k) => s + (k.high_top_of_page_bid_usd as number), 0) / withBid.length
            : 0;

      // Opportunity = real demand x real commercial intent / real difficulty.
      // Previously volume / (competition + 1), which ranked high-traffic
      // low-converting routes above lower-traffic routes that actually make
      // money. The bid multiplier is floored at 1 so a route with no bid
      // data reported is neither rewarded nor wiped out, just ranked on
      // demand and difficulty as before.
      const intentMultiplier = Math.max(1, avgBid);
      const score = Math.round(((volume * intentMultiplier) / (compIdx + 1)) * 100) / 100;
      await supabaseAdmin
        .from("route_candidates")
        .update({
          keywords_json: matched.slice(0, 12) as Json,
          search_volume: volume,
          competition_index: Math.round(compIdx * 100) / 100,
          opportunity_score: score,
          scored_at: new Date().toISOString(),
          score_error: null,
          status: "scored",
        })
        .eq("id", c.id);
      results.push({ from_code: c.from_code, to_code: c.to_code, ok: true, search_volume: volume, competition_index: Math.round(compIdx * 100) / 100, opportunity_score: score });
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      await supabaseAdmin.from("route_candidates").update({ score_error: msg, scored_at: new Date().toISOString(), status: "skipped" }).eq("id", c.id);
      results.push({ from_code: c.from_code, to_code: c.to_code, ok: false, error: msg });
      if (/OAuth|developer-token|PERMISSION|401|403/.test(msg)) break; // credential problem: stop burning the batch
    }
  }
  const { count: remaining } = await supabaseAdmin.from("route_candidates").select("id", { count: "exact", head: true }).eq("cabin", cabin).eq("status", "unscored");
  return { ok: true as const, scored: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, remaining_unscored: remaining ?? 0, results };
}

/** Scored candidates without a page, best opportunity first. Falls back to seed order when nothing is scored yet. */
export async function rankedCandidates(limit: number, cabin: Cabin = "economy") {
  const places = await loadPlacesAdmin();
  const { data: existing } = await supabaseAdmin.from("seo_pages").select("from_code, to_code").eq("page_type", "route").eq("cabin", cabin).limit(20000);
  const have = new Set((existing ?? []).map((e) => `${e.from_code}>${e.to_code}`));
  const { data: scored } = await supabaseAdmin
    .from("route_candidates")
    .select("from_code, to_code, cabin, search_volume, competition_index, opportunity_score, keywords_json, scored_at")
    .eq("cabin", cabin)
    .eq("status", "scored")
    .order("opportunity_score", { ascending: false, nullsFirst: false })
    .limit(limit * 4);
  const out = (scored ?? [])
    .filter((c) => !have.has(`${c.from_code}>${c.to_code}`))
    .slice(0, limit)
    .map((c) => {
      const g = places[c.from_code]!;
      const d = places[c.to_code]!;
      return {
        from_code: c.from_code, to_code: c.to_code, cabin: c.cabin,
        from_iata: g.iata, to_iata: d.iata, from_name: g.name, to_name: d.name, to_country: places[d.country_code]?.name ?? null,
        path: routePath(places, g.code, d.code, cabin)!,
        scoring: "keyword-planner" as const,
        search_volume: c.search_volume, competition_index: c.competition_index, opportunity_score: c.opportunity_score,
        keywords: c.keywords_json, scored_at: c.scored_at,
      };
    });
  if (out.length) return out;
  // Fallback: nothing scored yet (or all scored ones already have pages). Seed order, flagged honestly.
  const base = await workQueue("candidates", limit);
  return (base as { from_code: string; to_code: string; from_iata: string | null; to_iata: string | null; from_name: string; to_name: string; path: string }[]).map((c) => ({
    ...c, cabin, to_country: places[places[c.to_code]?.country_code ?? ""]?.name ?? null,
    scoring: "seed-order" as const, search_volume: null, competition_index: null, opportunity_score: null, keywords: [], scored_at: null,
  }));
}
