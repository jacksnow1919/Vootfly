import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Replaced 29 Sep 2026. The business-class 'AI travel concierge' (business and first class trips) is not a VootFly service. It also called a paid AI model on every message.
 * Nothing on the site linked here, but the address could still be opened
 * directly or remembered by search engines, so it redirects permanently.
 */
export const Route = createFileRoute("/_authenticated/concierge")({
  loader: () => {
    throw redirect({ href: "/dashboard", statusCode: 301 });
  },
});
