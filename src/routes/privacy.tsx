import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/site/ui";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | VootFly" },
      {
        name: "description",
        content:
          "How VootFly collects, uses, stores and protects your personal, passport and payment information when you book flights with VootFly.",
      },
      { property: "og:title", content: "Privacy Policy — VootFly" },
      { property: "og:description", content: "Data we collect, how we use it and your rights." },
    ],
  }),
  component: PrivacyPage,
});

const sections: { h: string; p: string[]; id?: string }[] = [
  {
    h: "1. Information we collect",
    p: [
      "We collect the information you provide when requesting a quote or submitting an online booking: name and title, date of birth, gender, passport number and expiry, nationality, email address, telephone number and billing address. We also collect payment card details through our payment processor, and technical data such as IP address, device type and pages viewed.",
    ],
  },
  {
    h: "2. How we use your information",
    p: [
      "Your information is used to search fares, request confirmation from airlines, issue tickets, process payments, prevent fraud, provide customer support, comply with legal and border-control obligations, and — where you have opted in — send fare alerts and promotional offers.",
    ],
  },
  {
    h: "3. Who we share it with",
    p: [
      "We share only the data necessary with operating airlines, global distribution systems and consolidators, payment processors and fraud-prevention providers, and government authorities where required by law. We do not sell your personal data.",
    ],
  },
  {
    h: "4. Payment card data",
    p: [
      "Card numbers are transmitted over encrypted connections and handled by PCI-DSS compliant processors. We do not store full card numbers or security codes on our systems. Where verification is required, sensitive documents are stored only for as long as needed and then securely deleted.",
    ],
  },
  {
    h: "5. Cookies and analytics",
    id: "cookies",
    p: [
      "We use essential cookies to keep your search and booking session working, and analytics cookies to understand which routes and fares travellers are interested in. You can disable non-essential cookies in your browser without losing access to booking functionality.",
    ],
  },
  {
    h: "6. Data retention",
    p: [
      "Booking records are retained for as long as required for accounting, tax, dispute-resolution and regulatory purposes. Marketing preferences are retained until you withdraw consent.",
    ],
  },
  {
    h: "7. Your rights",
    p: [
      "You may request access to, correction of, or deletion of your personal data, object to marketing, or ask us to restrict processing. Write to info@vootfly.com and we will respond within the period required by applicable law.",
    ],
  },
  {
    h: "8. Security and contact",
    p: [
      "We apply technical and organisational safeguards including encryption in transit, role-based access control and audit logging. For any privacy question contact info@vootfly.com, +1-800-773-6613, or 16007 Merrill Avenue, Apartment 52, Fontana, California 92335.",
    ],
  },
];

function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Privacy Policy"
      subtitle="How we handle traveller, passport and payment information."
    >
      <Card>
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.h} id={s.id} className="scroll-mt-20">
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
