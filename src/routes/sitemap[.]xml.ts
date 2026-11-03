import { createFileRoute } from "@tanstack/react-router";
import { listHubEntities, listPublishedPaths, getPlaces, descendantCodes } from "@/lib/seo-pages.functions";
import { destinationHubPath, originHubPath, chain } from "@/lib/hierarchy";

// FIXED 2026-09-22. "/destinations" removed: it now 301s to the real
// /flights-to/ index (the fabricated travel-data.ts was deleted), and a
// redirecting URL does not belong in a sitemap. "/airlines" restored: it and every
// /airlines/$slug page now render from real fare_snapshot_json data via
// airline-pages.functions.ts, replacing the fabricated travel-data.ts
// version. Individual /airlines/$slug pages are not enumerated here since
// their own noindex/index decision is made per-airline in their own head()
// (a real reference airline with zero current observations stays
// noindexed), matching the honesty pattern used for route pages.
const STATIC_PATHS = [
  "/",
  "/flights/",
  "/flights-from/",
  "/flights-to/",
  "/airlines",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/sitemap",
];

/**
 * Only indexable pages enter the sitemap (F1/F6): static pages, real-content
 * hub pages in the places tree, and seo_pages rows with status = published.
 * noindex and pending pages are excluded.
 *
 * Fixed 2026-09-16: this used to add a hub URL for every place in the
 * entire ancestor chain of every gateway/destination, regardless of
 * whether any real route existed for it. With 9 real routes (all
 * originating from NYC) against ~40 places in the hierarchy, that meant
 * dozens of near-empty hub pages (e.g. /flights-from/bos/, which has zero
 * real routes and renders one generic "being prepared" sentence) were
 * being submitted to Google -- a textbook thin-content-at-scale pattern,
 * and the direct, verified cause of Search Console showing a large batch
 * of "Discovered - currently not indexed" URLs. A hub page is now only
 * included if descendantCodes(place) genuinely overlaps a real published
 * route's from_code/to_code -- the exact same logic getOriginHub/
 * getDestinationHub already use to decide what content to show, reused
 * here rather than reimplemented, so the sitemap can never drift out of
 * sync with what a hub page actually renders.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const [published, gateways, destinations, places] = await Promise.all([
          listPublishedPaths(),
          listHubEntities({ data: { side: "origin" } }),
          listHubEntities({ data: { side: "destination" } }),
          getPlaces(),
        ]);

        const realFromCodes = new Set(published.map((r) => r.from_code).filter((c): c is string => !!c));
        const realToCodes = new Set(published.map((r) => r.to_code).filter((c): c is string => !!c));
        const hasRealOriginContent = (code: string) => descendantCodes(places, code).some((c) => realFromCodes.has(c));
        const hasRealDestinationContent = (code: string) => descendantCodes(places, code).some((c) => realToCodes.has(c));

        const hubPaths = new Set<string>();
        for (const g of gateways) {
          for (const p of chain(places, g.code)) {
            if (hasRealOriginContent(p.code)) hubPaths.add(originHubPath(p.code));
          }
        }
        for (const d of destinations) {
          for (const p of chain(places, d.code)) {
            if (hasRealDestinationContent(p.code)) {
              hubPaths.add(destinationHubPath(p.code, "business"));
              hubPaths.add(destinationHubPath(p.code, "first"));
            }
          }
        }
        // Airports under gateways/destinations
        for (const p of Object.values(places)) {
          if (p.level !== "airport") continue;
          if (p.is_us_gateway) {
            if (hasRealOriginContent(p.code)) hubPaths.add(originHubPath(p.code));
          } else if (hasRealDestinationContent(p.code)) {
            hubPaths.add(destinationHubPath(p.code, "business"));
            hubPaths.add(destinationHubPath(p.code, "first"));
          }
        }

        const entries: { loc: string; lastmod?: string }[] = [
          ...STATIC_PATHS.map((p) => ({ loc: origin + p })),
          ...[...hubPaths].map((p) => ({ loc: origin + p })),
          ...published.map((r) => ({ loc: origin + r.path, lastmod: r.updated_at?.slice(0, 10) })),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
        });
      },
    },
  },
});

