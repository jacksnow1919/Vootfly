import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL, confirmed still receiving real Google impressions despite no
 * matching route (was 404ing). Routes to contact, the closest current
 * equivalent to a quote request. See terms-conditions.tsx for the same pattern. */
export const Route = createFileRoute("/getaquote")({
  loader: () => {
    throw redirect({ href: "/contact", statusCode: 301 });
  },
});
