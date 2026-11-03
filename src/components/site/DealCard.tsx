import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { FeaturedDeal } from "@/lib/featured-deals";

export function DealCard({ deal }: { deal: FeaturedDeal }) {
  return (
    <Link
      to="/flight/booking"
      search={{
        origin: deal.originCode,
        destination: deal.destinationCode,
        departDate: deal.departureDate,
        cabin: deal.cabinClass,
        price: String(deal.price),
        airline: deal.airline || "Emirates",
        flightNo: "AS 204",
        currency: deal.currency || "USD",
      }}
      className="group block cursor-pointer rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-primary hover:shadow-lg"
    >
      <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
        {deal.trip}
      </span>
      <p className="mt-3 flex items-center gap-2 font-display text-lg font-semibold text-navy">
        {deal.from} <ArrowRight className="size-4 text-primary" /> {deal.to}
      </p>
      {deal.airline || deal.cabin ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {[deal.airline, deal.cabin].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">
        From <span className="font-display text-2xl font-bold text-gold">${deal.price}</span>
      </p>
      {deal.expiresAt ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Expires {new Date(deal.expiresAt).toLocaleDateString()}
        </p>
      ) : null}
      <span className="mt-3 inline-block text-xs font-semibold text-primary group-hover:underline">
        View deal
      </span>
    </Link>
  );
}
