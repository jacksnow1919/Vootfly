import { SITE_ORIGIN } from "@/lib/site-config";
import { Link, notFound, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/site/ui";
import { RoutePageView, type RouteContent } from "@/components/site/RoutePageView";
import { getRoutePage } from "@/lib/seo-pages.functions";
import { formatMoney, defaultRouteTitle, routeSlug, type Cabin, type FareSnapshot } from "@/lib/hierarchy";

type Params = { from: string; to: string; slug: string };

export function routePageLoader(cabin: Cabin) {
  return async ({ params }: { params: Params }) => {
    const from = params.from.toLowerCase();
    const to = params.to.toLowerCase();
    const result = await getRoutePage({ data: { from, to, cabin } });
    if (!result) throw notFound();
    // Wrong or old name slug (or uppercase codes): 301 to the canonical path.
    const canonicalSlug = routeSlug(result.places, from, to);
    if (params.slug !== canonicalSlug || params.from !== from || params.to !== to) {
      throw redirect({ href: result.canonicalPath, statusCode: 301 });
    }
    // No row, or hidden by RLS (pending): the page does not exist yet.
    if (!result.page) throw notFound();
    // Real, sourced checked-bag fees (economy) where we have one on file.
    // PKFARE does not supply this reliably, so it stays absent for any
    // airline without a real verified fee -- never filled with a guess.
    const { getBaggageFees } = await import("@/lib/baggage-fees.functions");
    const baggageFees = await getBaggageFees();
    return { ...result, cabin, baggageFees };
  };
}

export function routePageHead(cabin: Cabin) {
  return ({ loaderData }: { loaderData?: Awaited<ReturnType<ReturnType<typeof routePageLoader>>> }) => {
    if (!loaderData?.page) {
      return { meta: [{ title: "Route not found | VootFly" }, { name: "robots", content: "noindex" }] };
    }
    const { page, places, from, to, canonicalPath } = loaderData;
    const snapshot = (page.fare_snapshot_json ?? null) as FareSnapshot | null;
    // Meta title price reconciliation (fixed 2026-09-19).
    //
    // This previously read `page.meta_title ?? defaultRouteTitle(...)`, so a
    // stored title ALWAYS won. meta_title is only written when W1 generates
    // content, while fares are refreshed independently by W6, which means a
    // stored title quoted whatever the fare was on the day the copy was
    // written and could never catch up.
    //
    // The damage was real and live: after the cabin fix dropped fares to
    // genuine economy, 9 of 10 pages still advertised their old business
    // prices in Google. New York to Tokyo read "from $5,845" against a real
    // economy fare of $1,154 -- wrong in search results, and a fare that
    // high suppresses the click entirely.
    //
    // Now: if the stored title quotes a price that is not the current real
    // lowest fare, the title is rebuilt from the real fare. The stored title
    // is still used whenever it is accurate or quotes no price at all, so
    // this does not throw away W1's wording, it only stops it going stale.
    const lowestNow = snapshot?.lowest ? { amount: snapshot.lowest.amount, currency: snapshot.lowest.currency } : null;
    const storedTitle = page.meta_title ?? null;
    const storedQuotesAPrice = storedTitle ? /\$[\d,]+/.test(storedTitle) : false;
    const storedMatchesRealFare =
      storedTitle && lowestNow
        ? storedTitle.includes(formatMoney(lowestNow.amount, lowestNow.currency))
        : false;
    // Strict template pages (content_json.template === 2, 13 Nov 2026) never put a
    // price in the title: a title cannot carry the dates, passenger count and check
    // time a price needs. Their stored title holds no price (route-content-guard.ts).
    const strict = (page.content_json as { template?: unknown } | null)?.template === 2;
    const title = strict
      ? (storedTitle ?? defaultRouteTitle(places, from.code, to.code, cabin, null))
      : storedTitle && (!storedQuotesAPrice || storedMatchesRealFare)
        ? storedTitle
        : defaultRouteTitle(places, from.code, to.code, cabin, lowestNow);
    const description =
      page.meta_description ??
      `Flights from ${from.name} to ${to.name} with real fares and route details from VootFly advisors.`;
    const robots = page.status === "published" ? "index, follow" : "noindex, follow";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: robots },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: SITE_ORIGIN + canonicalPath },
        { name: "twitter:card", content: "summary_large_image" },
        // A real photo of the destination for link previews, when we have one.
        ...(loaderData.photo
          ? [
              { property: "og:image", content: loaderData.photo.og },
              { property: "og:image:alt", content: loaderData.photo.alt },
              { name: "twitter:image", content: loaderData.photo.og },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: SITE_ORIGIN + canonicalPath }],
    };
  };
}

export function RoutePageComponent({ data }: { data: Awaited<ReturnType<ReturnType<typeof routePageLoader>>> }) {
  const { page, photo, cabin, from, to, crumbs, canonicalPath, siblings, places, fromChain, toChain, baggageFees, publishedPaths } = data;
  if (!page) return null;
  return (
    <RoutePageView
      cabin={cabin}
      from={from}
      to={to}
      crumbs={crumbs}
      content={(page.content_json ?? {}) as RouteContent}
      snapshot={(page.fare_snapshot_json ?? null) as FareSnapshot | null}
      canonicalPath={canonicalPath}
      siblings={siblings}
      publishedPaths={publishedPaths}
      places={places}
      fromChain={fromChain}
      toChain={toChain}
      baggageFees={baggageFees}
      photo={photo}
    />
  );
}

export function RouteNotFound({ cabin }: { cabin: Cabin }) {
  const fromHub: string = "/flights-from/";
  return (
    <PageShell
      eyebrow="Flights"
      title="Route page not found"
      subtitle="This route page is not available yet. Try a live search or browse by departure city."
    >
      <div className="flex gap-4 text-sm font-semibold text-primary">
        <Link to={fromHub}>Browse by departure city</Link>
        <a href="/flight/search">Search live fares</a>
      </div>
    </PageShell>
  );
}
