import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Replaced 2026-09-22. This page used to render hardcoded, fabricated
 * destination data (src/lib/travel-data.ts, now deleted), including a
 * false "fares from $X" claim per city. VootFly already has real,
 * database-backed destination pages at /flights-to/, so this permanently
 * redirects there instead of maintaining a second, competing index.
 */
export const Route = createFileRoute("/destinations/")({
  loader: () => {
    throw redirect({ href: "/flights-to/", statusCode: 301 });
  },
});
