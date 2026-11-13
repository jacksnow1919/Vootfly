/**
 * Status rules and scheduled fare-refresh selection for seo_pages (14 Nov 2026).
 *
 * Pure functions with no imports, so they are unit-tested on their own
 * (page-status-rules.test.ts) and shared by seo-pages.server.ts.
 *
 * The owner's rule: a page that is pending (not approved) is never made public
 * by anything automatic. Only a request that explicitly sets a status changes it.
 */

/**
 * Status after a fare refresh. A pending page stays pending and an expired page
 * stays expired; anything else goes back through the publish gate (`evaluate`).
 */
export function statusAfterFareRefresh<S extends string>(
  current: string,
  evaluate: () => S,
): S | "pending" | "expired" {
  if (current === "pending" || current === "expired") return current;
  return evaluate();
}

/**
 * Status for a page save (POST /api/public/webhook/pages). An explicit status wins.
 * Without one, an existing pending page stays pending (added 14 Nov 2026: before,
 * re-sending a pending page's content re-ran the publish gate and could publish it);
 * a new page, or any other existing page, goes through the publish gate as before.
 */
export function statusForUpsert<S extends string>(
  explicit: S | undefined,
  existing: string | null | undefined,
  evaluate: () => S,
): S | "pending" {
  if (explicit) return explicit;
  if (existing === "pending") return "pending";
  return evaluate();
}

/** The cron runs every SCHEDULED_REFRESH_SLOT_MINUTES and refreshes at most one page. */
export const SCHEDULED_REFRESH_SLOT_MINUTES = 30;
/** A published page is due once its fare check is this old, so each page refreshes about daily. */
export const SCHEDULED_REFRESH_MIN_AGE_HOURS = 20;

export type RefreshCandidate = {
  path: string;
  page_type: string;
  status: string;
  from_code: string | null;
  to_code: string | null;
  cabin: string | null;
  fare_snapshot_at: string | null;
};

/**
 * The one page the scheduled refresh should check now, or null when none is due.
 *
 * Only published route pages are considered, so pending pages are never even searched.
 * The pick rotates with the clock (one slot per run) instead of always taking the
 * stalest page: a page whose check keeps failing (no fares, or the Worker's CPU limit)
 * would otherwise be picked on every run and block all the others.
 */
export function pickScheduledRefresh<T extends RefreshCandidate>(
  rows: T[],
  now = Date.now(),
): T | null {
  const minAgeMs = SCHEDULED_REFRESH_MIN_AGE_HOURS * 3_600_000;
  const due = rows
    .filter(
      (r) => r.page_type === "route" && r.status === "published" && !!r.from_code && !!r.to_code,
    )
    .filter((r) => {
      const t = r.fare_snapshot_at ? Date.parse(r.fare_snapshot_at) : NaN;
      return !Number.isFinite(t) || now - t >= minAgeMs;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!due.length) return null;
  const slot = Math.floor(now / (SCHEDULED_REFRESH_SLOT_MINUTES * 60_000));
  return due[slot % due.length] ?? null;
}
