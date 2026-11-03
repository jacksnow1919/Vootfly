import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

/**
 * Replaced 2026-09-22. The three old slugs came from fabricated data
 * (src/lib/travel-data.ts, now deleted) that stated a false lowest fare
 * per city. Each now 301s to VootFly's real, database-backed destination
 * hub for the same city, so any link or crawl history carries over.
 */
const LEGACY_SLUGS: Record<string, string> = {
  dubai: "/flights-to/dxb/",
  london: "/flights-to/lon/",
  singapore: "/flights-to/sin/",
};

export const Route = createFileRoute("/destinations/$slug")({
  loader: ({ params }) => {
    const target = LEGACY_SLUGS[params.slug.toLowerCase()];
    if (!target) throw notFound();
    throw redirect({ href: target, statusCode: 301 });
  },
});
