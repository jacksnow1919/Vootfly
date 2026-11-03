import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /deals retired as a standalone nav item (2026-09-17): deals now live under
 * Explore (/destinations) per the homepage/nav consolidation. This route is
 * kept as a 301 redirect rather than deleted, because /deals was already in
 * the sitemap and indexable -- deleting it would 404 a URL Google may hold
 * and drop any inbound links. A 301 passes that authority to /destinations
 * instead. The old hardcoded featuredDeals list (which carried placeholder
 * prices like $399/$100 that never matched real fares) no longer renders
 * anywhere as a result.
 */
export const Route = createFileRoute("/deals")({
  beforeLoad: () => {
    throw redirect({ href: "/flights-to/", statusCode: 301 });
  },
});
