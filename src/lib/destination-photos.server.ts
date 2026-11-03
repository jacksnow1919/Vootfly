import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Destination photos from Pixabay (added 28 Oct 2026).
 *
 * Pixabay's API rules: show search results only temporarily, never hotlink
 * Pixabay image addresses permanently (preview links expire after 24 hours),
 * and download any image you actually use to your own server. So the flow is:
 *   1. photo-search: a person searches, and gets options with links to each
 *      photo's Pixabay page to check it really shows that place.
 *   2. photo-save: the chosen photo is downloaded once and stored in VootFly's
 *      own storage bucket; pages only ever use that stored copy.
 * The API key lives in the project secret PIXABAY_API_KEY and never leaves the server.
 */
const PIXABAY = "https://pixabay.com/api/";
const BUCKET = "destination-photos";

type Hit = {
  id: number;
  pageURL: string;
  tags: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
};

function pixabayKey(): string | null {
  return process.env["PIXABAY_API_KEY"] || null;
}

async function pixabay(params: Record<string, string>): Promise<{ ok: true; total: number; hits: Hit[] } | { ok: false; error: string }> {
  const key = pixabayKey();
  if (!key) return { ok: false, error: "PIXABAY_API_KEY is not set in the project secrets." };
  const url = new URL(PIXABAY);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  // Never echo the request URL: it contains the key.
  if (!res.ok) return { ok: false, error: `Pixabay returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const body = (await res.json()) as { totalHits?: number; hits?: Hit[] };
  return { ok: true, total: body.totalHits ?? 0, hits: body.hits ?? [] };
}

export const photoSearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
  per_page: z.number().int().min(3).max(20).default(8),
});

export async function searchPhotos(input: z.infer<typeof photoSearchSchema>) {
  const r = await pixabay({
    q: input.query,
    image_type: "photo",
    orientation: "horizontal",
    safesearch: "true",
    min_width: "1280",
    order: "popular",
    per_page: String(input.per_page),
  });
  if (!r.ok) return r;
  return {
    ok: true as const,
    query: input.query,
    total: r.total,
    note: "Open each page link to check the photo really shows this place and is not marked as AI generated. Preview links expire after 24 hours.",
    results: r.hits.map((h) => ({
      pixabay_id: h.id,
      page: h.pageURL,
      preview: h.webformatURL,
      tags: h.tags,
      photographer: h.user,
      width: h.imageWidth,
      height: h.imageHeight,
    })),
  };
}

const placeCode = z.string().regex(/^[a-z0-9-]{2,8}$/);
export const photoSaveSchema = z.union([
  z.object({ place_code: placeCode, pixabay_id: z.number().int().positive(), alt: z.string().trim().min(5).max(160) }),
  z.object({ place_code: placeCode, remove: z.literal(true) }),
]);

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function download(url: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: HTTP ${res.status}`);
  const type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
  if (!EXT[type]) throw new Error(`Unexpected image type ${type}`);
  return { bytes: await res.arrayBuffer(), type };
}

async function clearFolder(placeCodeValue: string, keepPrefix?: string) {
  const { data } = await supabaseAdmin.storage.from(BUCKET).list(placeCodeValue, { limit: 100 });
  const stale = (data ?? []).filter((f) => !keepPrefix || !f.name.startsWith(keepPrefix)).map((f) => `${placeCodeValue}/${f.name}`);
  if (stale.length) await supabaseAdmin.storage.from(BUCKET).remove(stale);
}

export async function savePhoto(input: z.infer<typeof photoSaveSchema>) {
  const { data: place } = await supabaseAdmin.from("places").select("code, name").eq("code", input.place_code).maybeSingle();
  if (!place) return { ok: false as const, error: `unknown place_code ${input.place_code}` };

  if ("remove" in input) {
    await supabaseAdmin.from("destination_photos").delete().eq("place_code", input.place_code);
    await clearFolder(input.place_code);
    return { ok: true as const, place_code: input.place_code, removed: true };
  }

  const r = await pixabay({ id: String(input.pixabay_id) });
  if (!r.ok) return r;
  const hit = r.hits[0];
  if (!hit) return { ok: false as const, error: `Pixabay photo ${input.pixabay_id} not found` };

  try {
    const [large, small] = await Promise.all([download(hit.largeImageURL), download(hit.webformatURL)]);
    const prefix = `${hit.id}-`;
    const largePath = `${input.place_code}/${prefix}large.${EXT[large.type]}`;
    const smallPath = `${input.place_code}/${prefix}small.${EXT[small.type]}`;
    const opts = (contentType: string) => ({ contentType, upsert: true, cacheControl: "31536000" });
    const up1 = await supabaseAdmin.storage.from(BUCKET).upload(largePath, large.bytes, opts(large.type));
    if (up1.error) return { ok: false as const, error: `Upload failed: ${up1.error.message}` };
    const up2 = await supabaseAdmin.storage.from(BUCKET).upload(smallPath, small.bytes, opts(small.type));
    if (up2.error) return { ok: false as const, error: `Upload failed: ${up2.error.message}` };

    const publicUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(largePath).data.publicUrl;
    const thumbUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(smallPath).data.publicUrl;
    // largeImageURL is scaled to at most 1280 px wide.
    const width = Math.min(1280, hit.imageWidth);
    const height = Math.round((hit.imageHeight * width) / hit.imageWidth);

    const { error } = await supabaseAdmin.from("destination_photos").upsert(
      {
        place_code: input.place_code,
        source: "pixabay",
        source_id: String(hit.id),
        storage_path: largePath,
        public_url: publicUrl,
        thumb_url: thumbUrl,
        alt: input.alt,
        credit: hit.user,
        source_page_url: hit.pageURL,
        width,
        height,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "place_code" },
    );
    if (error) return { ok: false as const, error: error.message };
    await clearFolder(input.place_code, prefix);
    return { ok: true as const, place_code: input.place_code, place: place.name, public_url: publicUrl, thumb_url: thumbUrl, page: hit.pageURL, photographer: hit.user };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function listSavedPhotos() {
  const { data } = await supabaseAdmin
    .from("destination_photos")
    .select("place_code, source, source_id, public_url, thumb_url, alt, credit, source_page_url, updated_at")
    .order("place_code");
  return { ok: true as const, count: data?.length ?? 0, photos: data ?? [] };
}
