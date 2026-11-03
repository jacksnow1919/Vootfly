import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { resolveLegacySlug } from "@/lib/seo-pages.functions";

/**
 * Legacy v1 route URL: /flights/{origin}-to-{destination}
 * Permanently redirects to the v2 canonical path (/flights/{from}/{to}/{slug}/) or 404s.
 */
export const Route = createFileRoute("/flights/$slug")({
  loader: async ({ params }) => {
    const path = await resolveLegacySlug({ data: { slug: params.slug.toLowerCase() } });
    if (!path) throw notFound();
    throw redirect({ href: path, statusCode: 301 });
  },
});
