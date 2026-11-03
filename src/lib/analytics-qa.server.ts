/**
 * Analytics QA — Phase 7.
 *
 * Answers one question the blueprint calls out directly: are our numbers
 * actually trustworthy? If an analytics tool reports more bookings than
 * the bookings table contains, something is broken and every downstream
 * decision is built on a wrong number.
 *
 * The database is treated as the source of truth here, never the
 * analytics tool, because the bookings table is what the business
 * actually acts on. This function reports the real database side and the
 * discrepancy against whatever figure a caller supplies from analytics.
 * It does NOT call Mixpanel or GA4 itself -- pulling those requires
 * credentials this project does not have wired, and inventing a number
 * to compare against would defeat the entire purpose of the check.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AnalyticsQaReport = {
  windowDays: number;
  /** Real rows in the bookings table for the window. Source of truth. */
  databaseBookings: number;
  /** Real booking requests that passed blocking fare revalidation. */
  databaseConfirmedRevalidation: number;
  /** Supplied by the caller from the analytics tool, when available. */
  reportedBookings: number | null;
  /** reported - database. Positive means analytics is over-reporting. */
  discrepancy: number | null;
  discrepancyPercent: number | null;
  verdict: "match" | "analytics_over_reporting" | "analytics_under_reporting" | "no_analytics_figure_supplied";
  generatedAt: string;
};

/** Anything beyond this is worth investigating rather than rounding away. */
const TOLERANCE_PERCENT = 5;

export async function buildAnalyticsQaReport(windowDays = 30, reportedBookings: number | null = null): Promise<AnalyticsQaReport> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const [{ count: total }, { count: revalidated }] = await Promise.all([
    supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("revalidation_status", "confirmed"),
  ]);

  const databaseBookings = total ?? 0;

  if (reportedBookings === null) {
    return {
      windowDays,
      databaseBookings,
      databaseConfirmedRevalidation: revalidated ?? 0,
      reportedBookings: null,
      discrepancy: null,
      discrepancyPercent: null,
      verdict: "no_analytics_figure_supplied",
      generatedAt: new Date().toISOString(),
    };
  }

  const discrepancy = reportedBookings - databaseBookings;
  const discrepancyPercent =
    databaseBookings > 0 ? Math.round((discrepancy / databaseBookings) * 1000) / 10 : reportedBookings > 0 ? 100 : 0;

  const verdict =
    Math.abs(discrepancyPercent) <= TOLERANCE_PERCENT
      ? "match"
      : discrepancy > 0
        ? "analytics_over_reporting"
        : "analytics_under_reporting";

  return {
    windowDays,
    databaseBookings,
    databaseConfirmedRevalidation: revalidated ?? 0,
    reportedBookings,
    discrepancy,
    discrepancyPercent,
    verdict,
    generatedAt: new Date().toISOString(),
  };
}
