import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /llms.txt  (phase tracker 6.4, AEO groundwork; idea taken from EazAir)
 *
 * A plain-language summary of VootFly for AI assistants such as ChatGPT,
 * Gemini and Perplexity: what VootFly is, how booking really works, its key
 * pages, and every live route page (read from the database on each request,
 * so new pages appear automatically). Prices are deliberately NOT listed:
 * publishing specific fares in a new place needs internal sign-off.
 */
const ORIGIN = "https://www.vootfly.com";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getPlaces } = await import("@/lib/seo-pages.functions");
        const [{ data }, places] = await Promise.all([
          supabaseAdmin.from("seo_pages").select("path, from_code, to_code").eq("status", "published").eq("page_type", "route").limit(5000),
          getPlaces(),
        ]);
        const name = (c: string | null) => (c ? (places[c]?.name ?? c.toUpperCase()) : "");
        const routes = (data ?? [])
          .map((r) => ({ label: `${name(r.from_code)} to ${name(r.to_code)}`, url: ORIGIN + r.path }))
          .sort((a, b) => a.label.localeCompare(b.label));

        // Structure follows the llms.txt proposal (llmstxt.org), fixed 29 Oct 2026
        // after PageSpeed's Agentic Browsing check flagged it: one H1, a blockquote
        // summary, plain notes, then H2 sections that contain only link lists.
        const body = [
          "# VootFly",
          "",
          "> VootFly is an independent online travel agency based in the United States. Travellers compare real flight fares from live searches and send a booking request. A VootFly advisor then confirms availability and arranges payment with the traveller before anything is ticketed.",
          "",
          "How VootFly works:",
          "",
          "- Fares come from live searches with our fare providers. They are per person and subject to availability and change until a booking is confirmed.",
          "- When a traveller requests a booking, the live fare is re-checked straight away. If it has changed, the traveller sees the new price and decides whether to continue.",
          "- An advisor confirms availability and the fare rules, then contacts the traveller to arrange payment. Nothing is ticketed until the traveller confirms.",
          "- Fare watch: VootFly can email a traveller if a route's fare drops below the price they saw.",
          "- VootFly is not an airline. Baggage allowance, seats, schedules and refundability are set by the airline that issues the ticket.",
          "",
          "Contact: phone +1-800-773-6613, email info@vootfly.com, 16007 Merrill Avenue, Apartment 52, Fontana, California 92335, United States.",
          "",
          "## Key pages",
          "",
          `- [Flight search](${ORIGIN}/): search and compare live flight fares`,
          `- [Destinations](${ORIGIN}/flights-to/): flights by destination city`,
          `- [Departure cities](${ORIGIN}/flights-from/): flights by departure city`,
          `- [Airlines](${ORIGIN}/airlines): airlines seen in our real fare data`,
          `- [Fare Index](${ORIGIN}/research/fare-index): real observed fares and the method behind them`,
          `- [About VootFly](${ORIGIN}/about): who we are and how booking works`,
          `- [Refund & Cancellation Policy](${ORIGIN}/refund-policy): our service fees and how changes work`,
          `- [Terms & Conditions](${ORIGIN}/terms): the full agreement`,
          `- [Contact](${ORIGIN}/contact): phone and email`,
          "",
          "## Route pages",
          "",
          ...routes.map((r) => `- [${r.label} flights](${r.url}): lowest fares we found, airlines and travel times on this route`),
          "",
        ].join("\n");

        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
