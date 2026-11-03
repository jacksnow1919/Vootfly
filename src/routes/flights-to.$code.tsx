import { SITE_ORIGIN } from "@/lib/site-config";
import { requireTrailingSlash } from "@/lib/trailing-slash";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { HubPageView } from "@/components/site/HubPageView";
import { getDestinationHub } from "@/lib/seo-pages.functions";
import { destinationHubPath, placeLabel } from "@/lib/hierarchy";

const CABIN = "economy" as const;

export const Route = createFileRoute("/flights-to/$code")({
  beforeLoad: requireTrailingSlash,
  loader: async ({ params }) => {
    const code = params.code.toLowerCase();
    if (code !== params.code) throw redirect({ href: destinationHubPath(code, CABIN), statusCode: 301 });
    const hub = await getDestinationHub({ data: { code, cabin: CABIN } });
    if (!hub) throw notFound();
    return hub;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found | VootFly" }, { name: "robots", content: "noindex" }] };
    const { place, routes } = loaderData;
    const title = `Flights to ${placeLabel(place)} | VootFly`;
    const description = `Flights to ${place.name} from US gateways: ${routes.length} ${routes.length === 1 ? "route" : "routes"} with real fares and route details from VootFly advisors.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
      links: [{ rel: "canonical", href: SITE_ORIGIN + destinationHubPath(place.code, CABIN) }],
    };
  },
  component: () => {
    const hub = Route.useLoaderData();
    return <HubPageView side="destination" cabin={CABIN} place={hub.place} crumbs={hub.crumbs} children={hub.children} routes={hub.routes} places={hub.places} />;
  },
});
