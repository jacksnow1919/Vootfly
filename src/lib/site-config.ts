/**
 * Single source of truth for the site's public origin: canonical URLs,
 * BreadcrumbList/Product schema, the sitemap, and the EazAir deep_link_url.
 *
 * Update this ONE constant when the production domain changes. Previously
 * this string was hardcoded separately in 11+ files, which is exactly how
 * the site nearly shipped canonical tags and partner deep links pointing
 * at the wrong domain (fixed 2 Sep 2026 -- see docs/EAZAIR-META-SEARCH.md).
 *
 * Kept as a plain constant rather than process.env: several consumers
 * (Breadcrumbs, RoutePageView) are isomorphic React components that also
 * render on the client, where server-only env vars are not available.
 *
 * vootfly.com and www.vootfly.com are both connected and live in
 * Lovable's domain settings (confirmed by the site owner, 2 Sep 2026).
 * www is canonical here to match this codebase's existing convention
 * (the original flight.booking deep-link base already used www). If a
 * bare-apex canonical is preferred instead, change this one line --
 * everything else follows automatically.
 */
export const SITE_ORIGIN = "https://www.vootfly.com";
