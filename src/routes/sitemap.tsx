import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site/ui";
import { SITE_ORIGIN } from "@/lib/site-config";
import { listLiveRouteIndex } from "@/lib/seo-pages.functions";

export const Route = createFileRoute("/sitemap")({
  head: () => ({
    meta: [
      { title: "Sitemap | VootFly Flight Deals" },
      {
        name: "description",
        content:
          "Browse every page on VootFly — flight search, deals, destinations, airlines, support and policy pages in one place.",
      },
      { property: "og:title", content: "Sitemap | VootFly" },
      { property: "og:description", content: "All VootFly pages in one simple index." },
    ],
    links: [{ rel: "canonical", href: SITE_ORIGIN + "/sitemap" }],
  }),
  // Lists every live route page (added 29 Oct 2026); before this the HTML
  // sitemap linked to none of them.
  loader: async () => ({ liveIndex: await listLiveRouteIndex() }),
  component: SitemapPage,
});

const groups = [
  {
    title: "Explore",
    links: [
      { label: "Home", to: "/" as const },
      { label: "Deals", to: "/deals" as const },
      { label: "Flights", to: "/flights/" as const },
      { label: "Flights by departure city", to: "/flights-from/" as const },
      { label: "Flights by destination", to: "/flights-to/" as const },
      { label: "Airlines", to: "/airlines" as const },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", to: "/about" as const },
      { label: "Contact Us", to: "/contact" as const },
      { label: "Login / Signup", to: "/auth" as const },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" as const },
      { label: "Terms of Use", to: "/terms" as const },
      { label: "Refund & Cancellation Policy", to: "/refund-policy" as const },
    ],
  },
];

function SitemapPage() {
  const { liveIndex } = Route.useLoaderData();
  return (
    <PageShell
      eyebrow="Sitemap"
      title="All VootFly pages"
      subtitle="Find any page on VootFly in one place."
    >
      <div className="grid gap-6 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              {g.title}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {g.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-foreground hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {liveIndex.routes.length ? (
        <div className="mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Flight routes</h2>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            {liveIndex.routes.map((r) => (
              <li key={r.path}>
                <Link to={r.path} className="text-foreground hover:text-primary">
                  {r.from} to {r.to}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </PageShell>
  );
}
