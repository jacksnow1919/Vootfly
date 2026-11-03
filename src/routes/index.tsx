import { SITE_ORIGIN } from "@/lib/site-config";
import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FlightSearchWidget } from "@/components/site/FlightSearchWidget";
import { FLIGHT_SEARCH_ID, focusFlightSearch } from "@/lib/focus-search";
import type { PlaceMap } from "@/lib/hierarchy";
import type { HomeRoute } from "@/components/home/home-data";
import type { StoredPhotoRow } from "@/lib/destination-images";
import { Faq, PopularUsRoutes, RoutesAndDestinations, TrustStrip, WhyVootFly } from "@/components/home/HomeSections";
import { AdvisorCallBar } from "@/components/home/AdvisorCallBar";
import { HERO_SIZES, HERO_SRCSET, HeroArt } from "@/components/home/HeroArt";

const HOME_TITLE = "VootFly | Compare Cheap Flights & Book with a Real Advisor";
const HOME_DESCRIPTION = "Search and compare flight fares from airlines worldwide with VootFly. Find cheaper dates and book with the help of an advisor.";

/* Who VootFly is, as shown in the footer of every page. No SearchAction: the search needs a route and
   dates, so it cannot run from a single search term, and no sameAs: there are no social accounts yet. */
const SITE_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: "VootFly",
      url: `${SITE_ORIGIN}/`,
      logo: `${SITE_ORIGIN}/vootfly-logo.png`,
      email: "info@vootfly.com",
      telephone: "+1-800-773-6613",
      address: { "@type": "PostalAddress", streetAddress: "16007 Merrill Avenue, Apartment 52", addressLocality: "Fontana", addressRegion: "CA", postalCode: "92335", addressCountry: "US" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      name: "VootFly",
      url: `${SITE_ORIGIN}/`,
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    },
  ],
};

/**
 * Homepage, redesigned 2 Nov 2026 (owner's brief and mockups).
 *
 * First screen: header, short headline over the hero picture, the flight search and four benefits.
 * The hero is no longer forced to one full screen tall (that left large empty space above and below
 * the search on big monitors), so popular routes start right after it.
 * Then, as in the owner's reference image: popular routes beside popular destinations on computers,
 * the Why VootFly banner. Below those: the owner's US route cards, FAQs, footer.
 * The search starts filled with New York to London, as in the reference: a real route the traveller
 * can see and change.
 *
 * Integrity: prices come only from listHomeRoutes and only when they pass
 * hasVerifiedPrice (stored supplier fare, supplier-confirmed economy, checked
 * within 7 days), always with the checked date. No price is ever hardcoded.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: "VootFly: Search. Compare. Travel." },
      { property: "og:description", content: "Search and compare flight fares and find cheaper dates with VootFly." },
      { property: "og:url", content: SITE_ORIGIN + "/" },
      { name: "twitter:title", content: "VootFly: Search. Compare. Travel." },
      { name: "twitter:description", content: "Search and compare flight fares and find cheaper dates with VootFly." },
    ],
    links: [
      { rel: "canonical", href: SITE_ORIGIN + "/" },
      { rel: "preload", as: "image", imageSrcSet: HERO_SRCSET, imageSizes: HERO_SIZES, fetchPriority: "high" },
    ],
  }),
  component: Home,
  loader: async () => {
    const { listHomeRoutes, getPlaces, listDestinationPhotos } = await import("@/lib/seo-pages.functions");
    const [routes, places, photos] = await Promise.all([listHomeRoutes(), getPlaces(), listDestinationPhotos()]);
    return { routes, places, photos };
  },
});

function Home() {
  const { routes, places, photos } = Route.useLoaderData() as { routes: HomeRoute[]; places: PlaceMap; photos: Record<string, StoredPhotoRow> };
  useEffect(() => {
    if (window.location.hash === `#${FLIGHT_SEARCH_ID}`) focusFlightSearch();
  }, []);

  return (
    <div className="bg-white">
      <section className="relative bg-white">
        <HeroArt />
        <div className="relative mx-auto max-w-7xl px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-8 lg:px-8 lg:pb-6 lg:pt-7">
          <h1 className="max-w-3xl font-display text-[1.75rem] font-extrabold leading-[1.1] tracking-[-0.025em] text-navy sm:text-5xl lg:text-[3.25rem]">
            Find Better Flights.<br /> <span className="text-primary">Travel Smarter.</span>
          </h1>
          <p className="mt-2 max-w-xl text-[15px] font-medium leading-snug text-navy sm:mt-3 sm:text-lg sm:leading-relaxed">
            <span className="underline decoration-gold decoration-2 underline-offset-[5px]">Search and compare</span>{" "}
            flight fares from airlines worldwide.
          </p>
          <div className="mt-[5.5rem] sm:mt-[6.6rem] lg:mt-5">
            <FlightSearchWidget variant="hero" defaultOrigin="JFK" defaultDestination="LHR" />
          </div>
          <TrustStrip />
        </div>
      </section>

      <RoutesAndDestinations routes={routes} places={places} photos={photos} />
      <WhyVootFly />
      <PopularUsRoutes routes={routes} places={places} photos={photos} />
      <Faq />
      <AdvisorCallBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_SCHEMA) }} />
    </div>
  );
}
