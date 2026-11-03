import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, CircleUser, Phone, Menu, X, User } from "lucide-react";
import { RegionSettingsButton } from "@/components/site/RegionSettingsButton";

const PHONE_DISPLAY = "+1-800-773-6613";
const PHONE_TEL = "+18007736613";

/**
 * Header, redesigned 2 Nov 2026: VootFly | Flights  Hotels  Explore  Deals  Travel Guides,
 * then language and currency, account and the menu.
 * About, Contact and the phone number live in the menu. Hotels is in the owner's 2 Nov brief but no
 * hotel search or page exists, so it is marked Soon and is not a link: never a dead link or a page
 * with nothing behind it. Make it a real link in `primary` once there is a page.
 * Deals and Travel Guides have no page of their own and the homepage no longer has sections for them.
 * Deals goes to the destinations page, as /deals does (routes/deals.tsx). Travel Guides goes to the
 * departure cities page. Point them at real pages when those exist.
 *
 * The Explore and Travel Guides panels open on hover or keyboard focus using CSS alone, so they
 * add no JavaScript to every page, and their links stay in the HTML for crawlers.
 */
type Primary = {
  label: string;
  to: "/flights/" | "/flights-to/" | "/flights-from/";
  /** Shares its page with another item, so only that one is highlighted there. */
  noHighlight?: boolean;
  menu?: { label: string; href: string }[];
};
const primary: Primary[] = [
  { label: "Flights", to: "/flights/" },
  {
    label: "Explore",
    to: "/flights-to/",
    menu: [
      { label: "Destinations", href: "/flights-to/" },
      { label: "Departure cities", href: "/flights-from/" },
      { label: "Airlines", href: "/airlines/" },
      { label: "Fare Index", href: "/research/fare-index" },
    ],
  },
  { label: "Deals", to: "/flights-to/", noHighlight: true },
  {
    label: "Travel Guides",
    to: "/flights-from/",
    menu: [
      { label: "New York to London", href: "/flights/nyc/lon/new-york-to-london/" },
      { label: "Flights from New York", href: "/flights-from/nyc/" },
      { label: "Flights to Tokyo", href: "/flights-to/tyo/" },
      { label: "Flights to Paris", href: "/flights-to/par/" },
    ],
  },
];

const SoonTag = () => (
  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-navy/70">Soon</span>
);

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The homepage is the flight search, so Flights is the active item there too.
  const isActive = (l: Primary) => {
    if (l.noHighlight) return false;
    if (l.to === "/flights/") return pathname === "/" || pathname.startsWith("/flights/") || pathname.startsWith("/flight/");
    return pathname.startsWith(l.to);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const item = "rounded-xl px-3 py-3 hover:bg-accent";
  const close = () => setOpen(false);
  const iconButton = "grid size-10 place-items-center rounded-lg text-navy hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary";
  const navLink = "relative inline-flex items-center gap-1 whitespace-nowrap hover:text-primary focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
  const navLinkActive = "text-primary after:absolute after:inset-x-0 after:-bottom-2.5 after:h-0.5 after:rounded-full after:bg-primary";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-[linear-gradient(90deg,#FFFFFF_45%,#EAF5FF_100%)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] lg:px-8">
          <Link to="/" className="flex shrink-0 items-center justify-self-start">
            <picture>
              <source media="(min-width: 1024px)" srcSet="/brand/vootfly-logo-horizontal-tagline.svg" width={740} height={260} />
              <img src="/vootfly-logo.svg" alt="VootFly" className="h-9 w-[133px] object-contain lg:h-12" width={740} height={200} />
            </picture>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-5 text-[15px] font-semibold text-foreground md:flex lg:gap-6">
              {primary.map((l, i) => (
                <div key={l.label} className="group relative flex items-center gap-5 lg:gap-6">
                  <div className="relative">
                    <Link
                      to={l.to}
                      className={`${navLink} ${isActive(l) ? navLinkActive : ""}`}
                    >
                      {l.label}
                      {l.menu ? <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
                    </Link>
                    {l.menu ? (
                      <div className="invisible absolute left-0 top-full z-50 pt-3 opacity-0 transition-opacity duration-100 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                        <ul className="w-56 rounded-xl border border-border bg-card p-1.5 text-sm font-medium shadow-lux">
                          {l.menu.map((m) => (
                            <li key={m.href}>
                              <a href={m.href} className="block rounded-lg px-3 py-2 text-navy hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">
                                {m.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                  {i === 0 ? (
                    <span className="hidden cursor-default items-center gap-1.5 whitespace-nowrap text-muted-foreground lg:inline-flex" aria-label="Hotels, coming soon">
                      Hotels <SoonTag />
                    </span>
                  ) : null}
                </div>
              ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1 justify-self-end">
            <div className="hidden items-center gap-1 lg:flex">
              <RegionSettingsButton compact />
              <span aria-hidden="true" className="h-5 w-px bg-border" />
            </div>
            <Link to="/auth" aria-label="Sign in" title="Sign in" className={iconButton}>
              <CircleUser className="size-6" aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className={iconButton}>
              <Menu className="size-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button aria-label="Close menu" onClick={close} className="absolute inset-0 bg-navy/50 backdrop-blur-sm" />
          <aside role="dialog" aria-label="Menu" className="absolute right-0 top-0 h-full w-80 max-w-[88vw] overflow-y-auto bg-background p-5 shadow-lux">
            <div className="flex items-center justify-between">
              <span className="font-display text-base font-semibold text-navy">Menu</span>
              <button onClick={close} aria-label="Close menu" className="grid size-10 place-items-center rounded-xl border border-border hover:bg-accent">
                <X className="size-5" />
              </button>
            </div>

            <nav className="mt-5 flex flex-col gap-0.5 text-[15px] font-semibold">
              {/* The bar links are repeated here for phones only. */}
              {primary.map((l) => (
                <Link key={l.label} to={l.to} onClick={close} className={`${item} md:hidden`}>
                  {l.label}
                </Link>
              ))}
              <span className={`${item} flex items-center gap-2 text-muted-foreground hover:bg-transparent lg:hidden`} aria-label="Hotels, coming soon">
                Hotels <SoonTag />
              </span>
              <Link to="/about" onClick={close} className={item}>About Us</Link>
              <Link to="/contact" onClick={close} className={item}>Contact Us</Link>
            </nav>

            <div className="mt-6 border-t border-border pt-4">
              <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">Language and currency</p>
              <RegionSettingsButton />
            </div>
            <Link to="/auth" onClick={close} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold text-navy hover:bg-accent">
              <User className="size-4" /> Sign in
            </Link>
            <a href={`tel:${PHONE_TEL}`} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:brightness-110">
              <Phone className="size-4" /> {PHONE_DISPLAY}
            </a>
          </aside>
        </div>
      ) : null}
    </>
  );
}
