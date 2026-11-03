import { SITE_ORIGIN } from "@/lib/site-config";
import { requireTrailingSlash } from "@/lib/trailing-slash";
import { createFileRoute } from "@tanstack/react-router";
import { EntityIndexView } from "@/components/site/EntityIndexView";
import { listHubEntities, listLiveRouteIndex } from "@/lib/seo-pages.functions";

const TITLE = "Flights";
const DESCRIPTION = "Compare flights from every major US gateway to the world's top destinations, with real fares and advisor support.";

export const Route = createFileRoute("/flights/")({
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
    links: [{ rel: "canonical", href: SITE_ORIGIN + "/flights/" }],
  }),
  component: () => {
    const { gateways, destinations, liveIndex } = Route.useLoaderData();
    return (
      <EntityIndexView
        cabin="economy"
        title={TITLE}
        subtitle={DESCRIPTION}
        crumbs={[{ name: "Home", path: "/" }, { name: "Flights", path: null }]}
        gateways={gateways}
        destinations={destinations}
        liveIndex={liveIndex}
        show="both"
      />
    );
  },
});
