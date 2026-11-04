import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Clock3, Plane, ShieldCheck, TrainFront } from "lucide-react";
import { FlightSearchWidget } from "@/components/site/FlightSearchWidget";
import { Card, PageShell, SectionTitle } from "@/components/site/ui";
import { SITE_ORIGIN } from "@/lib/site-config";
import { requireTrailingSlash } from "@/lib/trailing-slash";

/**
 * Researched ATL -> PDX travel guide, reviewed 4 November 2026.
 *
 * The submitted travel notes were used for questions and decision points,
 * not copied as testimonials. Older claims that ATL-PDX nonstops are rare
 * conflict with current schedules, which show Delta and Alaska nonstop service.
 * Fare amounts, departure times and seat availability must come from the
 * live search, never hard-coded into this evergreen guide.
 */
const CANONICAL_PATH = "/flights/atl/pdx/atlanta-to-portland/";
const TITLE = "Atlanta to Portland Flights (ATL–PDX) | VootFly";
const DESCRIPTION =
  "Compare Atlanta to Portland flights, including Delta and Alaska nonstop options. Check live fares, flight times, baggage rules and practical PDX travel tips.";

const BREADCRUMBS = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
    { "@type": "ListItem", position: 2, name: "Flights", item: `${SITE_ORIGIN}/flights/` },
    { "@type": "ListItem", position: 3, name: "Atlanta to Portland", item: `${SITE_ORIGIN}${CANONICAL_PATH}` },
  ],
};

export const Route = createFileRoute("/flights/atl/pdx/atlanta-to-portland")({
  beforeLoad: requireTrailingSlash,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}${CANONICAL_PATH}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}${CANONICAL_PATH}` }],
  }),
  component: AtlantaToPortlandPage,
});

const questions = [
  {
    q: "Are there nonstop flights from Atlanta to Portland?",
    a: "Yes. Delta Air Lines and Alaska Airlines are listed with nonstop ATL–PDX service in November 2026 schedules. Availability depends on your travel date, so check current flight results before making plans.",
  },
  {
    q: "How long does a nonstop flight from ATL to PDX take?",
    a: "Allow roughly five to five and a half hours in the air for a nonstop flight. Your arrival clock will look earlier because Portland is three hours behind Atlanta; total travel time has not become shorter.",
  },
  {
    q: "Is it cheaper to fly to Seattle and travel to Portland?",
    a: "Sometimes, but compare the full trip. Add onward train or bus tickets, a possible hotel, ground transfers, baggage fees and the hours spent getting to Portland. A slightly cheaper Seattle fare may cost more overall.",
  },
  {
    q: "What is the best day to book an Atlanta–Portland flight?",
    a: "There is no reliably cheapest weekday for every trip. Compare a range of departure and return dates and check both nonstop and connecting options. Prices and airline rules can change between searches.",
  },
  {
    q: "How do I get from PDX to downtown Portland?",
    a: "The TriMet MAX Red Line links Portland International Airport with the city center. The journey is approximately 40 minutes. Check TriMet for current fares, service hours and disruptions.",
  },
];

function AtlantaToPortlandPage() {
  return (
    <PageShell
      eyebrow="ATL → PDX · Flight route guide"
      title="Flights from Atlanta to Portland (ATL–PDX)"
      subtitle="Compare live fares and make an informed choice between nonstop flights, connecting options and alternate airports."
    >
      <div className="space-y-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span aria-hidden="true"> / </span>
          <Link to="/flights/" className="hover:text-primary">Flights</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="font-medium text-navy">Atlanta to Portland</span>
        </nav>

        <section aria-labelledby="search-atl-pdx" className="rounded-2xl border border-border bg-white p-4 shadow-card sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="search-atl-pdx" className="font-display text-xl font-semibold text-navy">
              Search ATL to PDX flights
            </h2>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-navy">Live prices, not estimates</span>
          </div>
          <FlightSearchWidget defaultOrigin="ATL" defaultDestination="PDX" />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Flight fares are per traveler, change frequently and depend on dates, seats and fare conditions.
            VootFly re-checks fares before a booking request proceeds; an advisor confirms details before ticketing.
          </p>
        </section>

        <section aria-label="Route at a glance" className="grid gap-3 sm:grid-cols-3">
          <Card className="flex items-start gap-3">
            <Plane className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nonstop airlines</p>
              <p className="mt-1 font-semibold text-navy">Delta &amp; Alaska</p>
              <p className="mt-1 text-xs text-muted-foreground">Listed in November 2026 schedules; check your dates</p>
            </div>
          </Card>
          <Card className="flex items-start gap-3">
            <Clock3 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Typical nonstop flight</p>
              <p className="mt-1 font-semibold text-navy">About 5–5½ hours</p>
              <p className="mt-1 text-xs text-muted-foreground">Scheduled duration varies by flight and date</p>
            </div>
          </Card>
          <Card className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fares</p>
              <p className="mt-1 font-semibold text-navy">Check live availability</p>
              <p className="mt-1 text-xs text-muted-foreground">No invented “from” price or guaranteed deal</p>
            </div>
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(250px,0.36fr)]">
          <div className="space-y-6">
            <Card>
              <SectionTitle>Nonstop or connecting: which should you choose?</SectionTitle>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                For this route, nonstop service is a real option—not an exception. Delta Air Lines and Alaska
                Airlines currently appear on nonstop ATL–PDX schedules. A nonstop is often worth prioritizing
                when you have checked luggage, a tight arrival deadline or are traveling with family.
                Compare the final fare rather than assuming a connection is always cheaper.
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                A connecting itinerary may route through hubs such as Seattle (SEA), San Francisco (SFO),
                Chicago (ORD) or Houston (IAH), depending on the airline and departure date. Check the
                total journey time, the layover length and whether both flights are on one protected ticket.
                If a nonstop is canceled, a rebooking can still introduce a stop—leave slack in plans that
                cannot be moved.
              </p>
            </Card>

            <Card>
              <SectionTitle>How to compare the total cost of ATL–PDX tickets</SectionTitle>
              <ol className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
                <li>
                  <strong className="text-navy">1. Start with nearby dates.</strong> Compare a few departure and
                  return dates, including midweek if your schedule is flexible. There is no guarantee that
                  Tuesday or Wednesday will win on every search.
                </li>
                <li>
                  <strong className="text-navy">2. Check the complete fare.</strong> Review checked and carry-on
                  baggage, seat selection, change restrictions and any additional fees. A lower basic-economy
                  price is not automatically the better deal.
                </li>
                <li>
                  <strong className="text-navy">3. Compare nonstop against total travel time.</strong> A connection
                  can save money but also adds another departure, another airport and another chance of delay.
                  For families or shorter trips, convenience may outweigh a small difference in fare.
                </li>
                <li>
                  <strong className="text-navy">4. Re-check before confirming.</strong> Flight prices change.
                  Use the live flight search above for travel-date-specific options and confirm the final
                  itinerary and fare rules with your VootFly advisor.
                </li>
              </ol>
            </Card>

            <Card>
              <SectionTitle>Should you compare Portland (PDX) with Seattle (SEA)?</SectionTitle>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Seattle–Tacoma International Airport can be worth checking as an alternate arrival airport,
                especially on an expensive travel date. But SEA is not Portland: an onward train, bus or drive
                adds another leg after landing. Compare the combined airfare and ground-transfer costs,
                waiting time, luggage requirements and possible overnight stay before deciding.
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                If two ATL–PDX itineraries are similarly priced, the nonstop arriving at PDX may be the
                easier choice. If Seattle is significantly cheaper even after ground travel, a flexible
                traveler may prefer it. Neither airport is guaranteed to be cheaper on every date.
              </p>
            </Card>

            <Card>
              <SectionTitle>What to know about the airports</SectionTitle>
              <h3 className="mt-4 font-semibold text-navy">Leaving Atlanta (ATL)</h3>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">
                Hartsfield–Jackson Atlanta International Airport recommends arriving at least two hours before
                a domestic departure. Security waits vary, especially during early-morning peaks and holidays;
                check the airport's current checkpoint information before leaving.
              </p>
              <h3 className="mt-4 font-semibold text-navy">Arriving in Portland (PDX)</h3>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">
                From Portland International Airport, TriMet's MAX Red Line connects the terminal with downtown
                Portland in about 40 minutes. The station is accessible near baggage claim. Taxi, rideshare
                and rental-car alternatives are available if your destination is outside the rail corridor.
              </p>
              <div className="mt-3 rounded-xl bg-secondary/60 p-3 text-sm text-navy">
                <TrainFront className="mr-2 inline size-4 text-primary" aria-hidden="true" />
                <span className="font-semibold">Time-zone reminder:</span> Portland runs three hours behind
                Atlanta. Always compare actual flight duration, not just the local departure and arrival clocks.
              </div>
            </Card>

            <Card>
              <SectionTitle>Atlanta to Portland: frequently asked questions</SectionTitle>
              <div className="mt-4 divide-y divide-border">
                {questions.map(({ q, a }) => (
                  <section key={q} className="py-4 first:pt-0 last:pb-0">
                    <h3 className="font-semibold text-navy">{q}</h3>
                    <p className="mt-1 text-sm leading-7 text-muted-foreground">{a}</p>
                  </section>
                ))}
              </div>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <h2 className="font-display text-lg font-semibold text-navy">A quick decision checklist</h2>
              <ul className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <li>✓ Compare nonstop Delta and Alaska options for your dates.</li>
                <li>✓ Compare the all-in cost, including bags and seats.</li>
                <li>✓ Review connection protection if you choose one stop.</li>
                <li>✓ Add onward travel if comparing Seattle with Portland.</li>
                <li>✓ Check the exact fare and rules before booking.</li>
              </ul>
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold text-navy">Booking with VootFly</h2>
              <div className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>Compare available flights, send a booking request, and receive advisor confirmation before ticketing.</span>
              </div>
              <a
                href="#search-atl-pdx"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Search this route <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold text-navy">Sources and review date</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Reviewed <time dateTime="2026-11-04">November 4, 2026</time>. Travel advice also considers
                submitted passenger discussions; no personal accounts are reproduced or represented as VootFly customers.
                Schedules, transport fares and policies may change.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-primary">
                <li><a className="underline hover:text-navy" href="https://www.google.com/travel/flights/flights-from-atlanta-to-portland.html" target="_blank" rel="noopener noreferrer">ATL–PDX nonstop schedule overview</a></li>
                <li><a className="underline hover:text-navy" href="https://www.atl.com/passenger-information/passenger-security/" target="_blank" rel="noopener noreferrer">ATL airport security guidance</a></li>
                <li><a className="underline hover:text-navy" href="https://www.flypdx.com/GroundTransportation/Trimet" target="_blank" rel="noopener noreferrer">PDX official MAX rail guide</a></li>
                <li><a className="underline hover:text-navy" href="https://trimet.org/schedules/maxredline.htm" target="_blank" rel="noopener noreferrer">TriMet MAX Red Line schedules</a></li>
              </ul>
            </Card>
          </aside>
        </div>

        <div className="text-sm text-muted-foreground">
          Explore more routes in <Link to="/flights/" className="font-semibold text-primary underline">VootFly's flight directory</Link>.
          <span> </span>For routes and dates not listed here, use the live search above.
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS) }} />
    </PageShell>
  );
}
