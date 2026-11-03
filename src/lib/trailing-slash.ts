import { redirect } from "@tanstack/react-router";

/**
 * One address per page (added 29 Oct 2026).
 *
 * The router runs with trailingSlash: "preserve" (see router.tsx), so every
 * route and hub page answered with a 200 both with and without the final
 * "/". The canonical tag points at the "/" form, but Search Console showed
 * Google tracking both, and for Boston to London it picked the no-slash
 * address as the canonical after the "/" address returned a 404 during an
 * early October crawl. A 301 to the "/" form leaves one address per page.
 *
 * Used in beforeLoad on page routes only. The sitemap, robots.txt, llms.txt
 * and the /api/public/webhook/* endpoints are separate routes and keep their
 * exact addresses, which is why this is not a router-wide "always" setting.
 */
export function requireTrailingSlash({ location }: { location: { pathname: string; searchStr?: string } }) {
  if (!location.pathname.endsWith("/")) {
    throw redirect({ href: `${location.pathname}/${location.searchStr ?? ""}`, statusCode: 301 });
  }
}
