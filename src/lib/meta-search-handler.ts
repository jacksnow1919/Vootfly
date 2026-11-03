import { buildMetaSearchResponse, metaSearchSchema } from "@/lib/meta-search";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key",
  "access-control-max-age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS_HEADERS,
    },
  });

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const handleMetaSearchOptions = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const handleMetaSearch = async ({ request }: { request: Request }) => {
  const expected = process.env["META_SEARCH_API_KEY"];
  const provided = request.headers.get("x-api-key") ?? "";
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = metaSearchSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: "Invalid payload", issues: parsed.error.issues }, 400);
  }

  try {
    return json(await buildMetaSearchResponse(parsed.data));
  } catch (e) {
    console.error("[meta/search] failed to build response", e);
    return json({ error: "Internal error" }, 500);
  }
};
