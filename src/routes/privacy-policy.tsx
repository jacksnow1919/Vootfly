import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy URL, confirmed still receiving real Google impressions despite no
 * matching route (was 404ing). See terms-conditions.tsx for the same pattern. */
export const Route = createFileRoute("/privacy-policy")({
  loader: () => {
    throw redirect({ href: "/privacy", statusCode: 301 });
  },
});
