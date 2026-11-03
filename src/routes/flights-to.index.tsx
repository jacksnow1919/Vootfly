import { SITE_ORIGIN } from "@/lib/site-config";
import { requireTrailingSlash } from "@/lib/trailing-slash";
import { createFileRoute } from "@tanstack/react-router";
import { EntityIndexView } from "@/components/site/EntityIndexView";
import { listHubEntities, listLiveRouteIndex } from "@/lib/seo-pages.functions";

const TITLE = "Flights by Destination";
const DESCRIPTION = "Flights to every major destination from the US, grouped by region, with real fares.";

export const Route = createFileRoute("/flights-to/")({
  beforeLoad: requireTrailingSlash,
  loader: async () => {
    const [gateways, destinations, liveIndex] = await Promise.all([
      listHubEntities({ data: { side: "origin" } }),
      listHubEntities({ data: { side: "destination" } }),
      listLiveRouteIndex(),
    ]);
    return { gateways, destinations, liveIndex };
  },
  head: () => ({
    meta: [
      { title: TITLE + " | VootFly" },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: SITE_ORIGIN + "/flights-to/" }],
  }),
  component: () => {
    const { gateways, destinations, liveIndex } = Route.useLoaderData();
    return (
      <EntityIndexView
        cabin="economy"
        title={TITLE}
        subtitle={DESCRIPTION}
        crumbs={[{ name: "Home", path: "/" }, { name: "Flights", path: "/flights/" }, { name: "Flights to", path: null }]}
        gateways={gateways}
        destinations={destinations}
        liveIndex={liveIndex}
        show="destinations"
      />
    );
  },
});
