import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/webhook/indexable-urls
 *
 * Returns the real list of indexable URLs for IndexNow submission.
 *
 * Deliberately derived from the SAME rule the sitemap uses -- published
 * seo_pages plus the real static pages -- rather than a second hand-kept
 * list. Submitting a URL to IndexNow that the sitemap excludes (or vice
 * versa) sends search engines contradictory signals, and the thin-hub
 * pages removed from the sitemap in September must stay out of both.
 */
export const Route = createFileRoute("/api/public/webhook/indexable-urls")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("seo_pages")
          .select("path")
          .eq("status", "published")
          .limit(20000);

        if (error) {
          console.error("[indexable-urls] read failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const ORIGIN = "https://www.vootfly.com";
        const STATIC = ["/", "/flights/", "/flights-from/", "/flights-to/", "/deals", "/destinations", "/airlines", "/about", "/contact"];

        const urls = [
          ...STATIC.map((p) => ORIGIN + p),
          ...(data ?? []).map((r) => ORIGIN + r.path),
        ];

        return Response.json({ ok: true, count: urls.length, host: "www.vootfly.com", urls });
      },
    },
  },
});
