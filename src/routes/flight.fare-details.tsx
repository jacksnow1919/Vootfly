import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Replaced 29 Sep 2026. This business-class template page showed invented details for every fare (a lie-flat suite, lounge entry, a $250 refund fee and a $150 change fee) that contradicted VootFly's real Refund & Cancellation Policy.
 * Nothing on the site linked here, but the address could still be opened
 * directly or remembered by search engines, so it redirects permanently.
 */
export const Route = createFileRoute("/flight/fare-details")({
  loader: () => {
    throw redirect({ href: "/", statusCode: 301 });
  },
});
