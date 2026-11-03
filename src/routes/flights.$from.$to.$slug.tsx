import { createFileRoute } from "@tanstack/react-router";
import { requireTrailingSlash } from "@/lib/trailing-slash";
import { routePageLoader, routePageHead, RoutePageComponent, RouteNotFound } from "@/lib/route-page-config";

const CABIN = "economy" as const;

export const Route = createFileRoute("/flights/$from/$to/$slug")({
  beforeLoad: requireTrailingSlash,
  loader: routePageLoader(CABIN),
  head: routePageHead(CABIN),
  notFoundComponent: () => <RouteNotFound cabin={CABIN} />,
  component: Page,
});

function Page() {
  const data = Route.useLoaderData();
  return <RoutePageComponent data={data} />;
}
