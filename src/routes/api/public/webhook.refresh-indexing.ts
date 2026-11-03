import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * POST /api/public/webhook/refresh-indexing
 * body: { entries: [{ path, isIndexed, coverageState, lastCrawlTime }] }
 *
 * Writes back the REAL result of a Google URL Inspection call. Records only
 * what Google actually returned: a null verdict stays null rather than being
 * coerced to false, because "we have not been told" and "Google says no" are
 * different facts and conflating them would misreport coverage.
 *
 * indexing_checked_at is always stamped, even when the verdict is unknown,
 * so the oldest-checked-first queue keeps rotating instead of retrying the
 * same page forever.
 */
export const Route = createFileRoute("/api/public/webhook/refresh-indexing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorized } = await import("@/lib/seo-pages.server");
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

        let json: unknown = {};
        try {
          json = await request.json();
        } catch {
          json = {};
        }

        const parsed = z
          .object({
            entries: z
              .array(
                z.object({
                  path: z.string().min(1),
                  isIndexed: z.boolean().nullable().optional(),
                  coverageState: z.string().nullable().optional(),
                  lastCrawlTime: z.string().nullable().optional(),
                }),
              )
              .min(1)
              .max(100),
          })
          .safeParse(json ?? {});

        if (!parsed.success) {
          return Response.json({ ok: false, error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const checkedAt = new Date().toISOString();
        let updated = 0;
        const failures: string[] = [];

        for (const e of parsed.data.entries) {
          const { error } = await supabaseAdmin
            .from("seo_pages")
            .update({
              is_indexed: e.isIndexed ?? null,
              coverage_state: e.coverageState ?? null,
              last_crawl_time: e.lastCrawlTime ?? null,
              indexing_checked_at: checkedAt,
            })
            .eq("path", e.path);
          if (error) {
            console.error("[refresh-indexing] update failed", e.path, error);
            failures.push(e.path);
          } else {
            updated += 1;
          }
        }

        return Response.json({ ok: failures.length === 0, updated, failures });
      },
    },
  },
});
