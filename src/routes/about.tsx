import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Card, SectionTitle } from "@/components/site/ui";
import { Search, ShieldCheck, Headphones, BellRing, Phone, Mail } from "lucide-react";

/**
 * Rewritten 2026-09-22. The previous copy came from a business-class
 * template and made claims VootFly cannot support: "luxury travel agency",
 * "47+ partner airlines", "save up to 60%", "the price you are shown is the
 * price you pay", complimentary lounge access, lie-flat beds and chauffeur
 * transfers. Every statement below describes a feature that exists in the
 * product today (live fare search and comparison labels, blocking fare
 * re-check on booking request, advisor confirmation, fare watch emails,
 * the public Fare Index). No savings figures or specific fares are stated.
 */
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us | VootFly" },
      {
        name: "description",
        content:
          "VootFly is an independent online travel agency. Compare real flight fares, send a booking request, and a VootFly advisor confirms it with you before anything is ticketed.",
      },
      { property: "og:title", content: "About VootFly" },
      {
        property: "og:description",
        content: "Compare real flight fares and book with the help of a VootFly advisor.",
      },
    ],
  }),
  component: AboutPage,
});

const whyItems = [
  {
    icon: <Search className="size-5" />,
    title: "Real fares, side by side",
    body: "Every price comes from a live flight search, not an estimate. We label the lowest fare, the quickest trip and the option with the fewest stops, so the trade-offs are easy to see.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Price checked before you commit",
    body: "When you request a booking, we re-check the live fare straight away. If it has changed, we show you the new price and you decide whether to continue.",
  },
  {
    icon: <Headphones className="size-5" />,
    title: "A real advisor",
    body: "A VootFly advisor confirms availability and the fare rules with you by phone or email before anything is ticketed.",
  },
  {
    icon: <BellRing className="size-5" />,
    title: "Fare watch",
    body: "Ask us to watch a route and we will email you if the fare drops below the price you saw.",
  },
];

function AboutPage() {
  return (
    <PageShell
      eyebrow="About Us"
      title="Plan Your Affordable Travel with Us"
      subtitle="VootFly is an independent online travel agency. We help you compare real flight fares and book with the support of a real advisor."
    >
      <div className="space-y-4">
        <Card>
          <SectionTitle>How VootFly works</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Search once and compare real fares from different airlines side by side. Our prices come
            from live searches with our flight data provider, so what you see reflects what was
            actually available at the time of your search.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Airline prices change often, so every fare is shown per person and is subject to
            availability and change until your booking is confirmed.
          </p>
        </Card>

        <Card>
          <SectionTitle>What happens after you request a booking</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            When you send a booking request, we re-check the live fare immediately. If the price has
            changed since your search, we show you the new price and you choose whether to go ahead.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A VootFly advisor then confirms availability and the fare rules, contacts you, and
            arranges payment with you directly. Nothing is ticketed until you have confirmed.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If you need something specific, such as different dates or extra baggage, tell your
            advisor and they will check what the airline allows.
          </p>
        </Card>

        <Card>
          <SectionTitle>Our role, and what the airline controls</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            VootFly is an independent travel agency. We are not an airline and are not affiliated with any airline shown on
            this site. Your flight is operated by the airline that issues your ticket, under that airline's conditions of
            carriage.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <b className="text-navy">Set by the airline:</b> schedules, aircraft, baggage allowance, seat assignment, and
              whether a ticket can be changed or refunded and at what penalty.
            </li>
            <li>
              <b className="text-navy">Set by us:</b> our service fees for changes and for cancellations after ticketing,
              listed in our{" "}
              <Link to="/refund-policy" className="font-semibold text-navy underline hover:text-primary">
                Refund &amp; Cancellation Policy
              </Link>
              , and the help our advisors give you with your booking. The full agreement is in our{" "}
              <Link to="/terms" className="font-semibold text-navy underline hover:text-primary">
                Terms &amp; Conditions
              </Link>
              .
            </li>
          </ul>
        </Card>

        <Card>
          <SectionTitle>Why choose VootFly</SectionTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {whyItems.map((w) => (
              <div key={w.title} className="rounded-2xl border border-border bg-secondary/50 p-4">
                <span className="inline-grid size-10 place-items-center rounded-xl bg-navy text-navy-foreground">
                  {w.icon}
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-navy">{w.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Our fare data</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We publish the real fares we observe on popular routes in our{" "}
            <Link to="/research/fare-index" className="font-semibold text-navy underline hover:text-primary">
              Fare Index
            </Link>
            , so you can see what flights have actually been costing.
          </p>
        </Card>

        <Card>
          <SectionTitle>Talk to an advisor</SectionTitle>
          <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
            <a href="tel:+18007736613" className="inline-flex items-center gap-2 font-semibold text-navy hover:text-primary">
              <Phone className="size-4 text-gold" /> +1-800-773-6613
            </a>
            <a href="mailto:support@vootfly.com" className="inline-flex items-center gap-2 font-semibold text-navy hover:text-primary">
              <Mail className="size-4 text-gold" /> support@vootfly.com
            </a>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
