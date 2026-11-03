import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { getPlaces } from "@/lib/seo-pages.functions";
import { routePath } from "@/lib/hierarchy";

export const Route = createFileRoute("/flights/$from/$to/")({
  loader: async ({ params }) => {
    const places = await getPlaces();
    const path = routePath(places, params.from.toLowerCase(), params.to.toLowerCase(), "economy");
    if (!path) throw notFound();
    throw redirect({ href: path, statusCode: 301 });
  },
});
