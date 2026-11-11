import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, CircleHelp, Globe, Headset, Heart, Mail, MapPin, Phone, Plane, Scale, Search, ShieldCheck, Zap } from "lucide-react";
import { Price } from "@/components/site/Price";
import { FLIGHT_SEARCH_ID, focusFlightSearch } from "@/lib/focus-search";
import { destinationHubPath, type PlaceMap } from "@/lib/hierarchy";
import { photoFromUnsplash, resolveDestinationPhoto, type DestPhoto, type StoredPhotoRow } from "@/lib/destination-images";
import { SITE_ORIGIN } from "@/lib/site-config";
import { FARE_DISCLAIMER, FARE_SOURCE_NOTE, TRACKED_FARE_LABEL, type HomeRoute, addDays, checkedAgo, checkedLabel, cityName, hasVerifiedPrice, isoDate, primaryAirport } from "@/components/home/home-data";

/**
 * Homepage sections after the first screen, laid out as in the owner's reference image (2 Nov 2026):
 * popular routes beside popular destinations on computers, then the Why VootFly banner. Below those,
 * the owner's US route cards and the FAQs.
 *
 * INTEGRITY RULE: a price appears only when hasVerifiedPrice(route) is true
 * (stored supplier fare, supplier-confirmed economy, checked in the last 7 days)
 * and always with its checked date. Otherwise the item shows "Search fares".
 */
const MUTED = "text-[#4F5D75]";
export const ADVISOR_PHONE = "+1-800-773-6613";
export const ADVISOR_PHONE_TEL = "+18007736613";
const line = "border-border";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const cardHover = "transition hover:border-primary/40 hover:shadow-[0_8px_22px_-10px_rgba(16,47,99,0.25)] motion-safe:hover:-translate-y-0.5";
const container = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const sectionGap = "pb-6 sm:pb-8";
/* Phones: one row that scrolls sideways inside its own box, so the page itself never does. It must be
   `relative`: otherwise screen-reader text (sr-only) in off-screen cards widens the whole page.
   Tablets and computers: a grid, whose columns each list sets. */
const scroller = "relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden";
const scrollItem = "w-[46%] shrink-0 snap-start sm:w-auto";

/* A white rounded card with an icon, the title and, where there is one, a link to everything in that
   group. On phones the card's frame is dropped so the cards inside can use the full screen width. */
const Panel = ({ id, icon: Icon, title, action, children }: { id: string; icon: ComponentType<{ className?: string }>; title: string; action?: ReactNode; children: ReactNode }) => (
  <div id={id} className={`min-w-0 scroll-mt-20 ${line} sm:rounded-2xl sm:border sm:bg-white sm:p-4 sm:shadow-[0_6px_20px_-14px_rgba(16,47,99,0.3)]`}>
    <div className="flex flex-wrap items-center justify-between gap-x-3">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-[-0.01em] text-navy xl:text-[1.3rem]">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {title}
      </h2>
      {action}
    </div>
    <div className="mt-1.5 sm:mt-2">{children}</div>
  </div>
);

const MoreLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className={`group inline-flex min-h-10 shrink-0 items-center gap-1 text-[13px] font-bold text-primary underline-offset-4 hover:underline ${focusRing}`}>
    {children}
    <ArrowRight className="size-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
  </a>
);

type CardPhotoData = Pick<DestPhoto, "thumb" | "thumbSrcSet" | "alt">;

/* A photo card in a scroller: in a grid on a computer or tablet, swiped sideways on a phone. */
const PhotoCard = ({ href, photo, aspect, sizes, children }: { href: string; photo: CardPhotoData | null; aspect: string; sizes: string; children: ReactNode }) => (
  <li className={scrollItem}>
    <a href={href} className={`group flex h-full flex-col overflow-hidden rounded-xl border ${line} bg-white ${cardHover} ${focusRing}`}>
      <div className={`${aspect} overflow-hidden bg-[#EEF2F7]`}>
        {photo ? (
          <img
            src={photo.thumb}
            srcSet={photo.thumbSrcSet}
            sizes={sizes}
            alt={photo.alt}
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
          />
        ) : null}
      </div>
      <span className="flex flex-1 flex-col justify-between gap-1 p-2.5">{children}</span>
    </a>
  </li>
);

/* Shown under every block that displays a stored fare: where it came from, then the standard disclaimer. */
const Disclaimer = () => (
  <p className={`mt-3 text-xs ${MUTED}`}>
    {FARE_SOURCE_NOTE} {FARE_DISCLAIMER}
  </p>
);
const TrackedTag = () => <span className="block text-[11px] font-bold uppercase tracking-wide text-navy/70">{TRACKED_FARE_LABEL}</span>;
/* "Checked 3 hours ago", with the exact UTC time on hover and in the machine-readable datetime.
   Relative wording can differ by a minute between server and browser, so hydration warnings are suppressed. */
const CheckedAgo = ({ iso, className }: { iso: string | null; className?: string }) =>
  iso ? (
    <time dateTime={iso} title={checkedLabel(iso) ?? undefined} className={className} suppressHydrationWarning>
      {checkedAgo(iso)}
    </time>
  ) : null;

const searchNow = () => {
  if (!focusFlightSearch()) window.scrollTo({ top: 0, behavior: "smooth" });
};

/* Benefits directly under the search, worded as in the owner's reference wherever that is true of the
   product today:
   - Compare: search results list the fares the live search returns, side by side.
   - Prices: the fare is shown before a booking request is sent.
   - Availability: fare-revalidation.server.ts re-checks the fare when a booking request is sent.
     "Availability Checked" is the owner's own wording for when "Real-Time" is not accurate.
   - Support: phone and email, see /contact. No hours are published, so nothing like "when you need it".
   Never "real-time", "multiple sources" (a search shows the fares of whichever supplier answers
   first, see fare-provider.server.ts, so they are not combined), "lowest price" or "all airlines":
   the backend does not support those claims. */
export function TrustStrip() {
  const items = [
    { icon: Scale, title: "Compare More Options", body: "Fares from airlines worldwide" },
    { icon: ShieldCheck, title: "Transparent Prices", body: "See the fare before you book" },
    { icon: Zap, title: "Availability Checked", body: "Prices checked before booking" },
    { icon: Headset, title: "Travel Support", body: "Get help by phone or email" },
  ];
  return (
    <ul className="mx-auto mt-5 grid max-w-[66rem] grid-cols-2 gap-x-4 gap-y-4 sm:mt-6 lg:mt-4 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-border">
      {items.map((i) => (
        <li key={i.title} className="flex items-center gap-2.5 lg:justify-center lg:px-4">
          <i.icon className="size-7 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
          <p className="min-w-0 text-sm leading-tight">
            <span className="font-semibold text-navy">{i.title}</span>
            <span className={`mt-0.5 block text-[13px] leading-snug ${MUTED}`}>{i.body}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/* Popular routes: the four in the owner's reference. Each has a published page, or a real supplier search
   returned fares for it (checked on production, 2 Nov 2026: Chicago to Paris, Toronto to London). A route
   with a published page links there, any other links to a live search. */
const POPULAR_FEATURED: { from: string; to: string }[] = [
  { from: "nyc", to: "lon" },
  { from: "lax", to: "tyo" },
  { from: "chi", to: "par" },
  { from: "yto", to: "lon" },
];
const POPULAR: [string, string][] = [["nyc", "lax"], ["chi", "mia"], ["lax", "las"], ["was", "orl"], ["dfw", "sfo"], ["atl", "sea"]];
/* Card-specific photos chosen by the owner (31 Oct 2026), downloaded from each photographer's Unsplash
   page (2 Nov 2026) and self-hosted as WebP: a 600 px copy for phones and small cards and a larger one
   (900 to 1200 px, under 100 KB). Used only on that card, so nothing else on the site changes.
   Each photo was checked on its Unsplash page: free under the Unsplash License (not Unsplash+) and
   tagged with the place it shows (Seattle's has no location tag; it shows the Space Needle).
   File names and alt text describe what is in the photo, as Google's image guidelines recommend.
   Airports are the commercial airports serving each city, as the owner listed them; the search link
   uses the first one. */
type CardImage = { file: string; alt: string; width: number; credit: string; page: string; from: string[]; to: string[] };
const POPULAR_CARD_IMAGES: Record<string, CardImage> = {
  "nyc-lax": { file: "los-angeles-skyline-palm-trees", width: 1200, alt: "Palm trees in front of the downtown Los Angeles skyline at sunset", credit: "Cedric Letsch", page: "https://unsplash.com/photos/UZVlSjrIJ3o", from: ["JFK", "LGA", "EWR"], to: ["LAX"] },
  "chi-mia": { file: "miami-beach-aerial-coastline", width: 1200, alt: "Aerial view of the Miami Beach coastline and turquoise sea", credit: "Antonio Cuellar", page: "https://unsplash.com/photos/KDS5lCrj_ew", from: ["ORD", "MDW"], to: ["MIA"] },
  "lax-las": { file: "las-vegas-strip-night", width: 1200, alt: "The Las Vegas Strip at night with the Eiffel Tower replica at Paris Las Vegas", credit: "Parsa Mahmoudi", page: "https://unsplash.com/photos/PYaP4awj9Uc", from: ["LAX"], to: ["LAS"] },
  "was-orl": { file: "orlando-palm-trees-blue-sky", width: 900, alt: "Palm trees against a clear blue sky in Orlando, Florida", credit: "Brian Erickson", page: "https://unsplash.com/photos/qSvzmjCtj6A", from: ["IAD", "DCA", "BWI"], to: ["MCO"] },
  "dfw-sfo": { file: "golden-gate-bridge-fog-san-francisco", width: 1200, alt: "Fog rolling over the Golden Gate Bridge in San Francisco", credit: "Yang Liu", page: "https://unsplash.com/photos/Qe4P-Z0oe-4", from: ["DFW", "DAL"], to: ["SFO"] },
  "atl-sea": { file: "seattle-skyline-space-needle", width: 1200, alt: "Seattle skyline with the Space Needle and Mount Rainier at sunset", credit: "Madeline Liu", page: "https://unsplash.com/photos/vho10dg4Mdg", from: ["ATL"], to: ["SEA"] },
};
const cardImg = (c: CardImage) => ({
  thumb: `/images/routes/${c.file}-600.webp`,
  thumbSrcSet: `/images/routes/${c.file}-300.webp 300w, /images/routes/${c.file}-600.webp 600w, /images/routes/${c.file}.webp ${c.width}w`,
  alt: c.alt,
});
/* Featured route cards show the city the trip starts from, so they do not repeat the destination
   cards beside them (as in the owner's reference, 2 Nov 2026). Used only here, so no other page changes.
   Each was checked on its Unsplash page: Unsplash License, tagged with the place it shows. Landmarks
   whose image rights are held separately (the Hollywood Sign, Cloud Gate) were avoided on purpose. */
const ROUTE_RATIO = 3 / 2;
const ORIGIN_PHOTOS: Record<string, CardPhotoData> = {
  nyc: photoFromUnsplash({ id: "photo-1485738422979-f5c462d49f74", alt: "The Statue of Liberty in New York under a blue sky with white clouds", credit: "Fernando Strabuli", page: "https://unsplash.com/photos/statue-of-liberty-new-york-under-white-and-blue-cloudy-skies-PeFk7fzxTdk" }, ROUTE_RATIO),
  lax: photoFromUnsplash({ id: "photo-1638205022792-85c33651ae2c", alt: "Downtown Los Angeles skyscrapers and palm trees", credit: "Rihards Sergis", page: "https://unsplash.com/photos/a-view-of-a-city-with-tall-buildings-in-the-background--B_5ot_RdpA" }, ROUTE_RATIO),
  chi: photoFromUnsplash({ id: "photo-1760140314096-21fb8704301c", alt: "The Chicago skyline on a clear day", credit: "Joey Zhou", page: "https://unsplash.com/photos/chicago-skyline-on-a-clear-day-kDMoUbb7nkE" }, ROUTE_RATIO),
  yto: photoFromUnsplash({ id: "photo-1786394973121-b68df861e2e7", alt: "The Toronto skyline and CN Tower across Lake Ontario on a clear day", credit: "Andrii Khrystian", page: "https://unsplash.com/photos/toronto-skyline-with-cn-tower-5d8RlQJhqtg" }, ROUTE_RATIO),
};
/* Google image license metadata for the card photos: the photographer credit and the Unsplash
   License, which Google Images can show next to the photo.
   https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata */
const CARD_IMAGE_LICENSES = {
  "@context": "https://schema.org",
  "@graph": Object.values(POPULAR_CARD_IMAGES).map((c) => ({
    "@type": "ImageObject",
    contentUrl: `${SITE_ORIGIN}/images/routes/${c.file}.webp`,
    creator: { "@type": "Person", name: c.credit },
    creditText: `${c.credit} / Unsplash`,
    copyrightNotice: c.credit,
    license: "https://unsplash.com/license",
    acquireLicensePage: c.page,
  })),
};
const photoOf = (code: string, places: PlaceMap, photos: Record<string, StoredPhotoRow>) => resolveDestinationPhoto(code, places[code]?.parent_code, photos);
/* "New York → London" on screen; screen readers and crawlers get "New York to London". */
const RouteName = ({ from, to }: { from: string; to: string }) => (
  <>
    {from} <span className="sr-only">to </span>
    <ArrowRight className="mx-0.5 inline size-3.5 align-[-2px] text-primary" aria-hidden="true" /> {to}
  </>
);
/* A verified price with its label and checked time, otherwise "Search fares". */
const FareOrSearch = ({ priced }: { priced: HomeRoute | null }) =>
  priced ? (
    <span className="shrink-0 text-sm">
      <TrackedTag />
      <b className="text-navy"><Price usdAmount={priced.amount} /></b>
      <CheckedAgo iso={priced.checked_at} className={`block text-xs ${MUTED}`} />
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary">
      Search fares
      <ArrowRight className="size-3.5 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
    </span>
  );
const routeTitle = "block text-[13.5px] font-semibold leading-snug text-navy group-hover:text-primary";

/* Finds a route's published page and verified fare, or builds a live search a month out. */
const routeLookup = (routes: HomeRoute[]) => {
  const depart = addDays(new Date(), 30), ret = addDays(new Date(), 37);
  const page = (f: string, t: string) => routes.find((r) => r.from_code === f && r.to_code === t);
  return {
    page,
    priced: (f: string, t: string) => { const p = page(f, t); return p && hasVerifiedPrice(p) ? p : null; },
    search: (from: string, to: string) => `/flight/search?origin=${from}&destination=${to}&date=${isoDate(depart)}&returnDate=${isoDate(ret)}&passengers=1&cabin=Economy`,
  };
};

/* Destinations: six cities that each have a live VootFly destination page and a real photo of that
   city, the landmark shown in the owner's reference. Used only here, so destination pages keep their
   own photos. Each was checked on its Unsplash page: Unsplash License. No prices or offers here. */
const DESTINATION_RATIO = 1;
const POPULAR_DESTINATIONS: { code: string; photo: CardPhotoData }[] = [
  { code: "lon", photo: photoFromUnsplash({ id: "photo-1718913578316-a72e8a055369", alt: "Big Ben in London under a blue sky", credit: "Burak Şahin", page: "https://unsplash.com/photos/a-tall-clock-tower-towering-over-a-city-Nf1yi_BaLmU" }, DESTINATION_RATIO) },
  { code: "par", photo: photoFromUnsplash({ id: "photo-1604175287072-b5e71423060c", alt: "The Eiffel Tower in Paris under a blue sky", credit: "Filip Andrejevic", page: "https://unsplash.com/photos/eiffel-tower-under-blue-sky-during-daytime-FJYS6vuf39k" }, DESTINATION_RATIO) },
  { code: "tyo", photo: photoFromUnsplash({ id: "photo-1542955001-ff91d5369658", alt: "A red five-story pagoda in Tokyo", credit: "Charles Postiaux", page: "https://unsplash.com/photos/red-pagoda-temple-OifF1UFAdC0" }, DESTINATION_RATIO) },
  { code: "dxb", photo: photoFromUnsplash({ id: "photo-1546412414-e1885259563a", alt: "The Burj Al Arab in Dubai", credit: "Darcey Beau", page: "https://unsplash.com/photos/burj-al-arab-dubai-united-arab-emirates-during-daytime-vtK31JoeAFk" }, DESTINATION_RATIO) },
  { code: "rom", photo: photoFromUnsplash({ id: "photo-1568542368973-d5bd18e84cbd", alt: "The Colosseum in Rome under a blue sky", credit: "Zach Dyson", page: "https://unsplash.com/photos/brown-concrete-building-3mzn2xpA2YA" }, DESTINATION_RATIO) },
  { code: "bcn", photo: photoFromUnsplash({ id: "photo-1728249960363-13079cc2c6f6", alt: "The towers of the Sagrada Familia in Barcelona", credit: "Pourya Gohari", page: "https://unsplash.com/photos/a-very-tall-building-with-statues-on-its-sides-uoBCga1fNwU" }, DESTINATION_RATIO) },
];
/* Short names, as in the owner's reference: the destination cards are narrow. */
const countryName = (cc?: string) => {
  if (cc === "AE") return "UAE";
  if (cc === "GB") return "UK";
  try {
    return cc ? new Intl.DisplayNames(["en"], { type: "region" }).of(cc.toUpperCase()) ?? "" : "";
  } catch {
    return "";
  }
};

/* Popular routes beside popular destinations from 1280px, the width where six destination cards still
   have room for their names. Smaller screens stack the two panels. */
export function RoutesAndDestinations({ routes, places, photos = {} }: { routes: HomeRoute[]; places: PlaceMap; photos?: Record<string, StoredPhotoRow> }) {
  const lookup = routeLookup(routes);
  const anyPrice = POPULAR_FEATURED.some(({ from, to }) => lookup.priced(from, to));
  return (
    <section className="bg-white">
      <div className={`${container} ${sectionGap} grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] xl:gap-4`}>
        <Panel id="popular-routes" icon={Plane} title="Popular Flight Routes" action={<MoreLink href="/flights/">View all routes</MoreLink>}>
          <ul className={`${scroller} sm:grid-cols-4 sm:gap-2.5`}>
            {POPULAR_FEATURED.map(({ from, to }) => (
              <PhotoCard
                key={from + to}
                href={lookup.page(from, to)?.path ?? lookup.search(primaryAirport(from, places), primaryAirport(to, places))}
                photo={ORIGIN_PHOTOS[from] ?? photoOf(from, places, photos)}
                aspect="aspect-[3/2]"
                sizes="(min-width: 1280px) 130px, (min-width: 640px) 24vw, 46vw"
              >
                <span className={routeTitle}>
                  <RouteName from={cityName(from, places)} to={cityName(to, places)} />
                </span>
                <FareOrSearch priced={lookup.priced(from, to)} />
              </PhotoCard>
            ))}
          </ul>
          {anyPrice ? <Disclaimer /> : null}
        </Panel>

        <Panel id="popular-destinations" icon={MapPin} title="Explore Popular Destinations" action={<MoreLink href="/flights-to/">View all destinations</MoreLink>}>
          <ul className={`${scroller} sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-6 xl:gap-2`}>
            {POPULAR_DESTINATIONS.map(({ code, photo }) => (
              <PhotoCard
                key={code}
                href={destinationHubPath(code)}
                photo={photo}
                aspect="aspect-square"
                sizes="(min-width: 1280px) 92px, (min-width: 1024px) 150px, (min-width: 640px) 31vw, 46vw"
              >
                <span className="min-w-0">
                  <span className={routeTitle}>{cityName(code, places)}</span>
                  <span className={`block text-xs ${MUTED}`}>{countryName(places[code]?.country_code)}</span>
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
                  Explore
                  <ArrowRight className="size-3 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </PhotoCard>
            ))}
          </ul>
        </Panel>
      </div>
    </section>
  );
}

/* Beach photo in the banner below, as in the owner's reference. Decoration: it names no place, so the alt
   is empty. Checked on its Unsplash page: Unsplash License. Shown mirrored, so the bungalow sits at the
   banner's outer edge and the open sea fades into the banner. */
const WHY_PHOTO = photoFromUnsplash({ id: "photo-1774859524660-d26a3742d04b", alt: "", credit: "Logan Xu", page: "https://unsplash.com/photos/overwater-bungalow-with-boat-on-tropical-turquoise-sea-4yLwopNkPA4" }, 3 / 2);

/* Why Travelers Choose VootFly (2 Nov 2026): a banner as in the owner's reference. Each benefit is backed by
   something on the site today. No reviews, ratings or customer counts: VootFly has none to show yet.
   - Compare: flight.search.tsx puts fares side by side. Not the reference's "best deals": nothing proves best.
   - Discover: destination and route pages exist.
   - Understand: route pages and the Fare Index show fares observed and when; fees are in /refund-policy.
     Not the reference's "Track: monitor fare changes": price alert emails are not being sent.
   - Travel Smarter: the fare is re-checked and an advisor confirms before anything is ticketed. */
export function WhyVootFly() {
  const points = [
    { icon: Search, title: "Compare", body: "Fares side by side" },
    { icon: Globe, title: "Discover", body: "Explore new places" },
    { icon: BarChart3, title: "Understand", body: "Clear fare details" },
    { icon: Heart, title: "Travel Smarter", body: "Plan with confidence" },
  ];
  return (
    <section id="why-vootfly" className="scroll-mt-20 bg-white">
      <div className={`${container} ${sectionGap}`}>
        <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(100deg,#DDEEFF_0%,#EAF5FF_100%)]">
          <img
            src={WHY_PHOTO.thumb}
            srcSet={WHY_PHOTO.thumbSrcSet}
            sizes="(min-width: 1024px) 400px, calc(100vw - 32px)"
            alt=""
            width={900}
            height={600}
            loading="lazy"
            decoding="async"
            className="h-36 w-full -scale-x-100 object-cover object-[center_82%] [mask-image:linear-gradient(180deg,#000_55%,transparent)] sm:h-44 lg:absolute lg:inset-y-0 lg:left-0 lg:h-full lg:w-[32%] lg:[mask-image:linear-gradient(90deg,transparent,#000_50%)]"
          />
          <div className="relative p-5 pt-1 sm:p-6 sm:pt-2 lg:ml-[26%] lg:py-5 lg:pl-0">
            <h2 className="text-center font-display text-xl font-bold tracking-[-0.01em] text-navy xl:text-[1.5rem]">Why Travelers Choose VootFly?</h2>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
              <ul className="grid flex-1 grid-cols-2 gap-x-3 gap-y-4 xl:grid-cols-4 xl:gap-x-0 xl:divide-x xl:divide-[#C9DDF3]">
                {points.map((p) => (
                  <li key={p.title} className="flex items-center gap-2 xl:gap-1.5 xl:px-2 xl:first:pl-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm xl:size-8">
                      <p.icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[13.5px] font-bold leading-tight text-navy xl:whitespace-nowrap">{p.title}</h3>
                      <p className="mt-0.5 text-xs leading-snug text-[#33415C] xl:whitespace-nowrap">{p.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href={`#${FLIGHT_SEARCH_ID}`}
                onClick={(e) => {
                  e.preventDefault();
                  searchNow();
                }}
                className={`group inline-flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-card transition hover:brightness-110 ${focusRing}`}
              >
                Start Your Next Trip
                <ArrowRight className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* The owner's six US route cards, with the photos they chose (31 Oct 2026). */
export function PopularUsRoutes({ routes, places, photos = {} }: { routes: HomeRoute[]; places: PlaceMap; photos?: Record<string, StoredPhotoRow> }) {
  const lookup = routeLookup(routes);
  const anyPrice = POPULAR.some(([f, t]) => lookup.priced(f, t));
  return (
    <section className="bg-white">
      <div className={`${container} ${sectionGap}`}>
        <Panel id="us-routes" icon={Plane} title="Popular Routes Within the United States">
          <ul className={`${scroller} sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-6`}>
            {POPULAR.map(([f, t]) => {
              const page = lookup.page(f, t);
              const cardImage = POPULAR_CARD_IMAGES[`${f}-${t}`];
              return (
                <PhotoCard
                  key={f + t}
                  href={page ? page.path : lookup.search(cardImage?.from[0] ?? primaryAirport(f, places), cardImage?.to[0] ?? primaryAirport(t, places))}
                  photo={cardImage ? cardImg(cardImage) : photoOf(t, places, photos)}
                  aspect="aspect-[3/2]"
                  sizes="(min-width: 1280px) 190px, (min-width: 1024px) 150px, (min-width: 640px) 31vw, 46vw"
                >
                  <span className="min-w-0">
                    <span className={routeTitle}>
                      <RouteName from={cityName(f, places)} to={cityName(t, places)} />
                    </span>
                    {cardImage ? (
                      <span className={`mt-0.5 block text-xs ${MUTED}`}>
                        <span className="sr-only">Airports: </span>
                        {cardImage.from.join(", ")} to {cardImage.to.join(", ")}
                      </span>
                    ) : null}
                  </span>
                  <FareOrSearch priced={lookup.priced(f, t)} />
                </PhotoCard>
              );
            })}
          </ul>
          {anyPrice ? <Disclaimer /> : null}
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(CARD_IMAGE_LICENSES) }} />
        </Panel>
      </div>
    </section>
  );
}

/* FAQs: honest about search, fares, availability, booking and fees. Every answer is what the product
   does today; multi-city in particular is advisor-quoted, not a live search (MultiCityPlanner.tsx).
   Two independent columns on a computer, so opening an answer never leaves a gap beside it. */
const FAQS: { q: string; a: string; link?: boolean }[] = [
  { q: "How does VootFly flight search work?", a: "Enter your route, dates, travelers and cabin. We search fares from airlines worldwide through our flight data providers, and the results show what was available when you searched." },
  { q: "Can I compare different flight options on VootFly?", a: "Yes. Search results put fares side by side and label the lowest fare and the fewest stops, and every search also shows fares for the days around your date." },
  { q: "Can I search one-way flights?", a: "Yes. Choose One Way above the search form, then enter your route and departure date." },
  { q: "Can I search multi-city flights?", a: "Not as a live online search yet. Choose Multi-City above the search form to enter up to five flights and email the trip to an advisor, who replies with current fares. You can also call +1-800-773-6613." },
  { q: "How often are flight prices checked?", a: "Search results are live fares from the moment you search. Prices shown elsewhere on VootFly come from earlier searches and always say when they were checked, so they can be older. We re-check your fare when you send a booking request, and if it has changed you will see the new price first." },
  { q: "Can I search international flights?", a: "Yes. The search covers airports around the world. Type a city, airport name or IATA code into From and To." },
  { q: "How do I book a flight?", a: "Choose a fare and send a booking request. A VootFly advisor then contacts you to confirm availability and fare rules and to arrange payment. Nothing is ticketed until you confirm." },
  { q: "Can I change or cancel my booking, and what fees apply?", a: "Changes and refunds follow the airline's fare rules. Our own service fees are set out in our Refund & Cancellation Policy.", link: true },
];
export function Faq() {
  const schema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  const half = Math.ceil(FAQS.length / 2);
  return (
    <section className="bg-white">
      <div className={`${container} pb-8 sm:pb-10`}>
        <Panel id="faq" icon={CircleHelp} title="Frequently Asked Questions">
          <div className="mt-1 grid items-start gap-2 lg:grid-cols-2 lg:gap-x-3">
            {[FAQS.slice(0, half), FAQS.slice(half)].map((column) => (
              <div key={column[0]!.q} className="space-y-2">
                {column.map((f) => (
                  <details key={f.q} className={`group rounded-xl border ${line} bg-white`}>
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-navy focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden="true" className="text-xl leading-none text-primary transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className={`px-3.5 pb-3.5 text-sm leading-relaxed ${MUTED}`}>
                      {f.a}
                      {f.link ? <> <Link to="/refund-policy" className="font-semibold text-primary underline">Read the policy</Link>.</> : null}
                    </p>
                  </details>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5">
            <p className={`text-sm ${MUTED}`}>Still have a question?</p>
            <a href={`tel:${ADVISOR_PHONE_TEL}`} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline">
              <Phone className="size-4 shrink-0" aria-hidden="true" /> {ADVISOR_PHONE}
            </a>
            <a href="mailto:info@vootfly.com" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline">
              <Mail className="size-4 shrink-0" aria-hidden="true" /> info@vootfly.com
            </a>
          </div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        </Panel>
      </div>
    </section>
  );
}
