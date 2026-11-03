import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // FIXED 2026-09-22. The default ("never") answered every URL ending in
    // "/" with a 307 redirect to the slash-less form. But the sitemap (38
    // of 46 URLs), every canonical tag, the seo_pages paths, IndexNow and
    // the Search Console tracker all use the trailing-slash form. Result:
    // Google fetched the sitemap URL, was 307'd away, and the page it
    // landed on declared the redirecting URL as canonical -- a loop of
    // conflicting signals on every route and hub page.
    //
    // "preserve" serves both forms directly with no redirect; the canonical
    // tag (trailing slash) consolidates them. Deliberately not "always",
    // which would also append a slash to /sitemap.xml and to the
    // /api/public/webhook/* endpoints that n8n POSTs to.
    trailingSlash: "preserve",
  });

  return router;
};
