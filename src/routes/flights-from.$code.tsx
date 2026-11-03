import { SITE_ORIGIN } from "@/lib/site-config";
import { requireTrailingSlash } from "@/lib/trailing-slash";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { HubPageView } from "@/components/site/HubPageView";
import { getOriginHub } from "@/lib/seo-pages.functions";
import { originHubPath, placeLabel } from "@/lib/hierarchy";

export const Route = createFileRoute("/flights-from/$code")({
  beforeLoad: requireTrailingSlash,
  loader: async ({ params }) => {
    const code = params.code.toLowerCase();
    if (code !== params.code) throw redirect({ href: originHubPath(code), statusCode: 301 });
    const hub = await getOriginHub({ data: { code } });
    if (!hub) throw notFound();
    return hub;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found | VootFly" }, { name: "robots", content: "noindex" }] };
    const { place, routes } = loaderData;
    const title = `Flights from ${placeLabel(place)} | VootFly`;
    const description = `Flights departing ${place.name}: ${routes.length} ${routes.length === 1 ? "route" : "routes"} with real fares and advisor support from VootFly.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
      links: [{ rel: "canonical", href: SITE_ORIGIN + originHubPath(place.code) }],
    };
  },
  component: () => {
    const hub = Route.useLoaderData();
    return <HubPageView side="origin" cabin="economy" place={hub.place} crumbs={hub.crumbs} children={hub.children} routes={hub.routes} places={hub.places} />;
  },
});
