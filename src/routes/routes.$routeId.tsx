import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

/**
 * Replaced 2026-09-22. This page rendered fabricated fares from
 * src/lib/travel-data.ts (now deleted) while calling itself a "Live fare
 * comparison", and it was not noindexed. Each old route id now 301s to the
 * real equivalent: the real route page where VootFly publishes one, or the
 * real destination hub where it does not (there is no real Los Angeles to
 * Dubai page, so that one goes to the Dubai hub rather than inventing one).
 */
const LEGACY_ROUTES: Record<string, string> = {
  "nyc-london": "/flights/nyc/lon/new-york-to-london/",
  "nyc-delhi": "/flights/nyc/del/new-york-to-delhi/",
  "lax-dubai": "/flights-to/dxb/",
};

export const Route = createFileRoute("/routes/$routeId")({
  loader: ({ params }) => {
    const target = LEGACY_ROUTES[params.routeId.toLowerCase()];
    if (!target) throw notFound();
    throw redirect({ href: target, statusCode: 301 });
  },
});
