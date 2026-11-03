/**
 * Page Contract System — Phase 1 Foundation, ROUTE pages only.
 *
 * A machine-readable spec for what a page of a given type must have before
 * it's allowed to be considered complete/publishable. This is a NEW,
 * ADDITIVE layer -- it does not replace, call, or get called by the
 * existing SEO pipeline (evaluateStatus, upsertPages, the W1 QA gate, or
 * the W1/W2/W6 n8n workflows). Those are untouched and remain the actual
 * publish decision-makers.
 *
 * What this file adds: a precise, checkable definition of "what a route
 * page needs," and a pure audit function that can check a real page
 * against it. Treat this as a diagnostic/reporting tool for this phase --
 * wiring it into the actual publish path (so a contract violation could
 * block publishing) is a deliberate Phase 2+ decision, not made here.
 *
 * QA_PUBLISH_THRESHOLD is imported (read-only) from the existing pipeline
 * so this contract's QA requirement always reflects the real threshold,
 * rather than a second number that could drift out of sync with it.
 */
import { QA_PUBLISH_THRESHOLD } from "@/lib/seo-pages.server";

/**
 * Generalised in Phase 5 (was: `= "route"` only).
 *
 * Adding a type here does NOT create pages for it. It gives the QA/audit
 * layer a place to define what such a page must contain BEFORE anything
 * generates one, so a new page type cannot ship thinner than a route page
 * by accident -- the failure mode that put dozens of near-empty hub pages
 * into the sitemap earlier in this project.
 */
export type PageType = "route" | "hub" | "airline" | "airport" | "destination" | "guide";

export type PageIntent = "transactional";

/** The contract itself -- what a ROUTE page must satisfy. Describes the
 * existing real shape of seo_pages route rows (content_json.heading/intro/
 * sections/faqs, fare_snapshot_json, meta_title/meta_description) rather
 * than inventing new requirements the live pipeline doesn't already meet. */
export interface RoutePageContract {
  pageType: "route";
  origin: string;
  destination: string;
  intent: PageIntent;
  requiredData: {
    /** A real fare snapshot (fare_snapshot_json) with at least a lowest fare. */
    hasFareSnapshot: boolean;
    /** meta_title and meta_description both present and non-empty. */
    hasMeta: boolean;
  };
  requiredContent: {
    /** content_json.heading present. */
    hasHeading: boolean;
    /** content_json.intro present. */
    hasIntro: boolean;
    /** At least this many content_json.sections. */
    minSections: number;
    /** At least this many content_json.faqs. */
    minFaqs: number;
  };
  requiredLinks: {
    /** RoutePageView's own internal-linking sections (Explore / By Airport /
     * More From-To) are rendered unconditionally by the component today --
     * this flag exists so a future page type without that guarantee has
     * something to check against, not because route pages currently need
     * remediation here. */
    hasInternalLinks: boolean;
  };
  freshness: {
    /** Matches snapshotIsFresh()'s real window in hierarchy.ts -- see the
     * note in auditRoutePage() below about why this isn't re-implemented. */
    maxFareSnapshotAgeHours: number;
  };
  indexation: {
    /** Mirrors the real gate: only "published" status pages are indexable. */
    indexableStatuses: readonly string[];
  };
  qa: {
    minScore: number;
  };
}

/** The standard contract every route page is measured against in this phase. */
export const ROUTE_PAGE_CONTRACT: RoutePageContract = {
  pageType: "route",
  origin: "*",
  destination: "*",
  intent: "transactional",
  requiredData: { hasFareSnapshot: true, hasMeta: true },
  requiredContent: { hasHeading: true, hasIntro: true, minSections: 4, minFaqs: 6 },
  requiredLinks: { hasInternalLinks: true },
  freshness: { maxFareSnapshotAgeHours: 72 },
  indexation: { indexableStatuses: ["published"] },
  qa: { minScore: QA_PUBLISH_THRESHOLD },
};

/**
 * Minimum bar any page type must clear to be worth indexing. Route pages
 * have their own richer contract above; this is the floor every other type
 * inherits so none can ship as filler.
 *
 * Deliberately data-driven rather than word-count based: a page earns
 * indexation by carrying real supplier or reference data, not by being long.
 */
export interface GenericPageContract {
  pageType: Exclude<PageType, "route">;
  intent: PageIntent | "informational";
  /** At least this many real, sourced data points must be present. */
  minRealDataPoints: number;
  /** Page must link to at least this many genuinely related pages. */
  minInternalLinks: number;
  requiresFreshData: boolean;
  indexation: { indexableStatuses: readonly string[] };
  qa: { minScore: number };
}

/** Floors per page type. Hub pages are strictest because thin hubs were the
 * measured cause of the "Discovered - currently not indexed" backlog. */
export const GENERIC_PAGE_CONTRACTS: Record<Exclude<PageType, "route">, GenericPageContract> = {
  hub: {
    pageType: "hub",
    intent: "transactional",
    minRealDataPoints: 3, // at least one real route, one real fare, one real airline
    minInternalLinks: 3,
    requiresFreshData: true,
    indexation: { indexableStatuses: ["published"] },
    qa: { minScore: QA_PUBLISH_THRESHOLD },
  },
  airline: {
    pageType: "airline",
    intent: "informational",
    minRealDataPoints: 2, // real carrier identity + at least one real observed route
    minInternalLinks: 2,
    requiresFreshData: false, // airline reference data is static, not a live fare
    indexation: { indexableStatuses: ["published"] },
    qa: { minScore: QA_PUBLISH_THRESHOLD },
  },
  airport: {
    pageType: "airport",
    intent: "informational",
    minRealDataPoints: 2,
    minInternalLinks: 2,
    requiresFreshData: false,
    indexation: { indexableStatuses: ["published"] },
    qa: { minScore: QA_PUBLISH_THRESHOLD },
  },
  destination: {
    pageType: "destination",
    intent: "transactional",
    minRealDataPoints: 2,
    minInternalLinks: 3,
    requiresFreshData: true,
    indexation: { indexableStatuses: ["published"] },
    qa: { minScore: QA_PUBLISH_THRESHOLD },
  },
  guide: {
    pageType: "guide",
    intent: "informational",
    minRealDataPoints: 1,
    minInternalLinks: 2,
    requiresFreshData: false,
    indexation: { indexableStatuses: ["published"] },
    qa: { minScore: QA_PUBLISH_THRESHOLD },
  },
};

/** Audits any non-route page against its type's floor. Pure function: no
 * database access, no side effects, same input always gives the same result. */
export function auditGenericPage(input: {
  path: string;
  pageType: Exclude<PageType, "route">;
  status: string;
  qaScore: number | null;
  realDataPoints: number;
  internalLinks: number;
  hasFreshData: boolean;
}): ContractAuditResult {
  const contract = GENERIC_PAGE_CONTRACTS[input.pageType];
  const violations: ContractViolation[] = [];
  if (input.realDataPoints < contract.minRealDataPoints) {
    violations.push({
      field: "realDataPoints",
      message: `Has ${input.realDataPoints} real data points, ${input.pageType} pages require at least ${contract.minRealDataPoints}.`,
    });
  }
  if (input.internalLinks < contract.minInternalLinks) {
    violations.push({
      field: "internalLinks",
      message: `Has ${input.internalLinks} internal links, requires at least ${contract.minInternalLinks}.`,
    });
  }
  if (contract.requiresFreshData && !input.hasFreshData) {
    violations.push({ field: "freshData", message: "Requires fresh supplier data and none is present." });
  }
  if ((input.qaScore ?? 0) < contract.qa.minScore) {
    violations.push({
      field: "qaScore",
      message: `QA score ${input.qaScore ?? "none"} is below the ${contract.qa.minScore} threshold.`,
    });
  }
  return { path: input.path, compliant: violations.length === 0, violations };
}

export type ContractViolation = {
  field: string;
  message: string;
};

export type ContractAuditResult = {
  path: string;
  compliant: boolean;
  violations: ContractViolation[];
};

/** The minimal shape this auditor needs from a seo_pages row -- callers pass
 * in real row data (e.g. from a Supabase select), this function never
 * fetches anything itself. Pure function: same input always gives the same
 * result, no network/database access here. */
export type RoutePageAuditInput = {
  path: string;
  status: string;
  qa_score: number | null;
  meta_title: string | null;
  meta_description: string | null;
  fare_snapshot_at: string | null;
  fare_snapshot_json: { lowest?: { amount?: number } } | null;
  content_json: {
    heading?: string;
    intro?: string;
    sections?: unknown[];
    faqs?: unknown[];
  } | null;
};

/**
 * Checks one real route page against ROUTE_PAGE_CONTRACT. Does not fetch
 * data, does not write anything, does not change a page's status -- purely
 * a read/report function for this phase.
 */
export function auditRoutePage(
  page: RoutePageAuditInput,
  contract: RoutePageContract = ROUTE_PAGE_CONTRACT,
): ContractAuditResult {
  const violations: ContractViolation[] = [];
  const content = page.content_json ?? {};

  if (contract.requiredData.hasFareSnapshot && !page.fare_snapshot_json?.lowest?.amount) {
    violations.push({ field: "fare_snapshot_json", message: "No real fare snapshot with a lowest amount." });
  }
  if (contract.requiredData.hasMeta && (!page.meta_title || !page.meta_description)) {
    violations.push({ field: "meta_title/meta_description", message: "Missing meta title or description." });
  }
  if (contract.requiredContent.hasHeading && !content.heading) {
    violations.push({ field: "content_json.heading", message: "Missing heading." });
  }
  if (contract.requiredContent.hasIntro && !content.intro) {
    violations.push({ field: "content_json.intro", message: "Missing intro." });
  }
  const sectionCount = content.sections?.length ?? 0;
  if (sectionCount < contract.requiredContent.minSections) {
    violations.push({
      field: "content_json.sections",
      message: `Has ${sectionCount} sections, contract requires at least ${contract.requiredContent.minSections}.`,
    });
  }
  const faqCount = content.faqs?.length ?? 0;
  if (faqCount < contract.requiredContent.minFaqs) {
    violations.push({
      field: "content_json.faqs",
      message: `Has ${faqCount} FAQs, contract requires at least ${contract.requiredContent.minFaqs}.`,
    });
  }
  if ((page.qa_score ?? 0) < contract.qa.minScore) {
    violations.push({
      field: "qa_score",
      message: `QA score ${page.qa_score ?? "none"} is below the ${contract.qa.minScore} threshold.`,
    });
  }
  // Freshness is intentionally reported, not independently recomputed:
  // hierarchy.ts's real snapshotIsFresh() is the actual freshness gate the
  // live site uses (RoutePageView, the index gate). Re-implementing that
  // window here would risk silently drifting out of sync with it -- this
  // audit only flags a missing timestamp outright, and leaves the real
  // freshness *decision* to the existing function, which this file does
  // not duplicate or call (staying additive-only, per this phase's scope).
  if (contract.requiredData.hasFareSnapshot && !page.fare_snapshot_at) {
    violations.push({ field: "fare_snapshot_at", message: "No fare snapshot timestamp at all." });
  }

  return { path: page.path, compliant: violations.length === 0, violations };
}
