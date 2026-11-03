import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Replaced 29 Sep 2026. This business-class template page promised negotiated premium cabin fares, upgrades and lie-flat cabins, which VootFly does not offer.
 * Nothing on the site linked here, but the address could still be opened
 * directly or remembered by search engines, so it redirects permanently.
 */
export const Route = createFileRoute("/corporate")({
  loader: () => {
    throw redirect({ href: "/contact", statusCode: 301 });
  },
});
