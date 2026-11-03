import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getSeoRoutePage = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { data: row, error } = await publicClient()
      .from("seo_route_pages")
      .select("slug, origin, destination, meta_title, meta_description, content_json")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) return null;
    return row;
  });

export const listSeoRouteSlugs = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("seo_route_pages")
    .select("slug, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return [];
  return data ?? [];
});

export const listSeoRoutePages = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("seo_route_pages")
    .select("slug, origin, destination, meta_title, meta_description")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return [];
  return data ?? [];
});

