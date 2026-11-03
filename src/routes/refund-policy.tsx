import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Card } from "@/components/site/ui";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund & Cancellation Policy | VootFly" },
      {
        name: "description",
        content:
          "Our refund and cancellation policy: fare rules, airline penalties, service fees, refund timelines, involuntary changes and how to request a refund.",
      },
      { property: "og:title", content: "Refund & Cancellation Policy | VootFly" },
      { property: "og:description", content: "Fare rules, penalties, timelines and how to claim." },
    ],
  }),
  component: RefundPage,
});

const sections: { h: string; p: string[] }[] = [
  {
    h: "1. Fare rules govern every refund",
    p: [
      "Each ticket carries the fare rules of the airline that issued it. Discounted fares are typically non-refundable, non-transferable and non-endorsable. Before you pay, our team will confirm in writing whether your selected fare is refundable, partially refundable or fully restricted.",
    ],
  },
  {
    h: "2. Cancellation before ticketing",
    p: [
      "If your online booking has been received but no ticket has been issued, you may cancel free of charge. Any amount authorised or captured on your card is released or refunded in full.",
    ],
  },
  {
    h: "3. Cancellation after ticketing",
    p: [
      "Once ticketed, refunds are calculated as: fare paid, minus the airline cancellation penalty, minus non-refundable taxes and carrier surcharges, minus our post-ticketing service fee of USD 75 per passenger per ticket. Where the fare is fully restricted, only genuinely refundable government taxes can be returned.",
    ],
  },
  {
    h: "4. Changes and reissue",
    p: [
      "Date, routing and name changes are subject to the airline change penalty plus any fare difference, plus our reissue service fee of USD 50 per passenger. Changes are only effective once the airline confirms the reissue in writing.",
    ],
  },
  {
    h: "5. No-shows and unused tickets",
    p: [
      "Failure to check in for a flight normally forfeits the value of that segment and may automatically cancel onward segments. Partially used tickets are refunded, where permitted, on a pro-rata basis calculated by the airline, not by us.",
    ],
  },
  {
    h: "6. Involuntary cancellations and schedule changes",
    p: [
      "If the airline cancels your flight, materially changes the schedule or downgrades your cabin, you are entitled to the remedy set out in the carrier's conditions of carriage and applicable passenger-rights regulations. We will file and pursue the claim on your behalf at no additional service fee.",
    ],
  },
  {
    h: "7. Refund processing time",
    p: [
      "Approved refunds are filed with the airline within 3 business days of your request. Airlines generally take 7 to 45 business days to release funds, and your bank may take a further 5 to 10 business days to post the credit. We will share the airline refund reference so you can track progress.",
    ],
  },
  {
    h: "8. How to request a refund",
    p: [
      "Email info@vootfly.com with your booking id and reason, or call +1-800-773-6613. Written requests are timestamped on receipt, and that timestamp is used when airline penalties are tiered by date.",
    ],
  },
  {
    h: "9. Chargebacks",
    p: [
      "Please contact us before raising a chargeback. Disputes filed while a refund is already in progress can delay the airline's release of funds and may cause the refund to be rejected.",
    ],
  },
];

function RefundPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      subtitle="What happens when plans change: penalties, fees and timelines."
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
