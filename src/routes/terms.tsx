import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/site/ui";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions | VootFly" },
      {
        name: "description",
        content:
          "Read the Terms & Conditions governing bookings, fares, payments, changes and liability when booking flights with VootFly.",
      },
      { property: "og:title", content: "Terms & Conditions — VootFly" },
      { property: "og:description", content: "Booking, fare, payment and liability terms." },
    ],
  }),
  component: TermsPage,
});

const sections: { h: string; p: string[] }[] = [
  {
    h: "1. Agreement",
    p: [
      "These Terms & Conditions govern your use of the VootFly website and any booking request submitted through it. By submitting an online booking you confirm that you are at least 18 years of age, legally able to enter a binding contract, and that you accept these terms on behalf of every traveller named in your request.",
    ],
  },
  {
    h: "2. Our role as an agent",
    p: [
      "VootFly acts as an independent travel agent. Air transportation is provided by the operating carrier and is subject to that carrier's conditions of carriage and applicable tariffs. We do not own or operate any aircraft, lounge, hotel or ground transport service.",
    ],
  },
  {
    h: "3. Fares, quotes and price parity",
    p: [
      "Fares displayed come from live searches with our fare providers and are not guaranteed until ticketed by the airline. Airlines may withdraw or revalue inventory at any time. Where a quoted fare is no longer available, we will contact you with the closest alternative and you may accept it or cancel your request at no cost.",
      "All prices are quoted in the currency shown at checkout and include airline taxes, carrier-imposed surcharges and government fees unless expressly stated otherwise.",
    ],
  },
  {
    h: "4. Booking request and confirmation",
    p: [
      "An online booking submitted through our website is a request, not a confirmed reservation. Your booking is sent to the airline for confirmation and a sales representative will contact you with an update. E-tickets are issued only after the airline confirms availability and payment is successfully authorised and captured.",
    ],
  },
  {
    h: "5. Payment and card authorisation",
    p: [
      "By submitting card details and accepting these terms at checkout you authorise VootFly or its payment processor to charge the card for the total amount displayed. We may request additional verification documents, including a copy of the cardholder's photo identification and a signed authorisation form, before ticketing. Bookings for which verification is refused may be cancelled and refunded in full.",
    ],
  },
  {
    h: "6. Passenger information and travel documents",
    p: [
      "You are responsible for the accuracy of all names, dates of birth and passport details supplied. Names must match the passport exactly. Airlines generally do not permit name changes and may require full cancellation and rebooking at the prevailing fare. You are solely responsible for holding valid passports, visas, transit permits and health documentation.",
    ],
  },
  {
    h: "7. Changes, cancellations and no-shows",
    p: [
      "Changes and cancellations are governed by the fare rules of the ticket issued, plus our service fee where applicable. Discounted fares are frequently non-refundable and non-changeable. No-shows normally forfeit the entire fare. Our Refund & Cancellation Policy forms part of these terms.",
    ],
  },
  {
    h: "8. Schedule changes and irregular operations",
    p: [
      "Airlines may change schedules, aircraft, cabin configuration or routing. VootFly will notify you of any change communicated to us but is not liable for delay, cancellation, denied boarding, downgrade, missed connection or consequential loss caused by the carrier or by events beyond our control.",
    ],
  },
  {
    h: "9. Limitation of liability",
    p: [
      "To the maximum extent permitted by law, our total liability arising from any booking is limited to the service fee we received for that booking. Nothing in these terms excludes liability that cannot lawfully be excluded.",
    ],
  },
  {
    h: "10. Governing law and contact",
    p: [
      "These terms are governed by the laws applicable at our principal place of business. Questions may be sent to info@vootfly.com or +1-800-773-6613, or by post to 16007 Merrill Avenue, Apartment 52, Fontana, California 92335.",
    ],
  },
];

function TermsPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Terms & Conditions"
      subtitle="Please read these terms carefully before submitting an online booking."
    >
      <Card>
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-lg font-semibold text-navy">{s.h}</h2>
              {s.p.map((para) => (
                <p key={para} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
