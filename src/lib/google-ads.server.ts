/**
 * Google Ads Keyword Planner (REST). Real search volume and competition only.
 * Secrets (Lovable): GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
 * GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID (digits only), GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC, digits only).
 */
const API_VERSION = "v23";
const US_GEO = "geoTargetConstants/2840";
const ENGLISH = "languageConstants/1000";

export type KeywordMetric = {
  keyword: string;
  avg_monthly_searches: number;
  competition: "LOW" | "MEDIUM" | "HIGH" | "UNSPECIFIED" | "UNKNOWN";
  competition_index: number; // 0-100
  low_top_of_page_bid_usd?: number;
  high_top_of_page_bid_usd?: number;
};

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing Google Ads secret ${name}`);
  return v;
}

export function googleAdsConfigured(): boolean {
  return ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"].every((k) => Boolean(process.env[k]));
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    client_id: env("GOOGLE_ADS_CLIENT_ID"),
    client_secret: env("GOOGLE_ADS_CLIENT_SECRET"),
    refresh_token: env("GOOGLE_ADS_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error(`Google OAuth token failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/**
 * Keyword ideas + metrics for a set of seed keywords (US, English, Google Search).
 * One API call per invocation. Returns the seeds and related ideas with real metrics.
 */
export async function keywordIdeas(seeds: string[], pageSize = 60): Promise<KeywordMetric[]> {
  const customerId = env("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, "");
  const login = (process.env["GOOGLE_ADS_LOGIN_CUSTOMER_ID"] ?? "").replace(/-/g, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "Content-Type": "application/json",
  };
  if (login) headers["login-customer-id"] = login;

  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}:generateKeywordIdeas`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      keywordSeed: { keywords: seeds.slice(0, 20) },
      geoTargetConstants: [US_GEO],
      language: ENGLISH,
      keywordPlanNetwork: "GOOGLE_SEARCH",
      includeAdultKeywords: false,
      pageSize,
    }),
  });
  if (!res.ok) throw new Error(`Keyword Planner failed: ${res.status} ${(await res.text()).slice(0, 400)}`);
  const json = (await res.json()) as {
    results?: { text: string; keywordIdeaMetrics?: { avgMonthlySearches?: string | number; competition?: string; competitionIndex?: string | number; lowTopOfPageBidMicros?: string | number; highTopOfPageBidMicros?: string | number } }[];
  };
  return (json.results ?? []).map((r) => {
    const m = r.keywordIdeaMetrics ?? {};
    return {
      keyword: r.text,
      avg_monthly_searches: Number(m.avgMonthlySearches ?? 0),
      competition: (m.competition as KeywordMetric["competition"]) ?? "UNSPECIFIED",
      competition_index: Number(m.competitionIndex ?? 0),
      ...(m.lowTopOfPageBidMicros ? { low_top_of_page_bid_usd: Number(m.lowTopOfPageBidMicros) / 1_000_000 } : {}),
      ...(m.highTopOfPageBidMicros ? { high_top_of_page_bid_usd: Number(m.highTopOfPageBidMicros) / 1_000_000 } : {}),
    };
  });
}
