import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy URL, confirmed still receiving real Google clicks (Search Console
 * performance data: 6 impressions, 1 click in 28 days) despite there being
 * no matching route -- these hits were landing on a 404. Almost certainly a
 * holdover from the ASAirspace template this project was copied from.
 * 301s to the current real page so that existing ranking is preserved
 * rather than lost, and real visitors stop hitting a dead page.
 */
export const Route = createFileRoute("/terms-conditions")({
  loader: () => {
    throw redirect({ href: "/terms", statusCode: 301 });
  },
});
