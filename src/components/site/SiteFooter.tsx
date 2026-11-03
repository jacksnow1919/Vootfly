import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Mail } from "lucide-react";

/**
 * Footer, redesigned 2 Nov 2026. Every link goes to a live page. There are no social media links
 * because VootFly has no social accounts to link to yet. Cookie Policy goes to the cookies section
 * of the Privacy Policy, which is where that wording lives. Support is the support mailbox.
 */
const heading = "text-xs font-bold uppercase tracking-[0.14em] text-white/70";
const linkClass = "inline-block py-1 hover:text-white hover:underline underline-offset-4";

export function SiteFooter() {
  return (
    <footer className="bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:px-8">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Link to="/" className="inline-flex items-center">
            <img
              src="/brand/vootfly-logo-mono-white.svg"
              alt="VootFly"
              className="h-9 w-[133px] object-contain"
              loading="lazy"
              width={740}
              height={200}
            />
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-navy-foreground/80">
            VootFly helps travellers find affordable flight deals worldwide
            and book with an advisor's help.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-navy-foreground/85">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-white/60" aria-hidden="true" />
              16007 Merrill Avenue, Apartment 52, Fontana, California 92335
            </li>
            <li className="flex gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-white/60" aria-hidden="true" />
              <a href="tel:+18007736613" className="hover:text-white hover:underline underline-offset-4">
                +1-800-773-6613
              </a>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 size-4 shrink-0 text-white/60" aria-hidden="true" />
              <a href="mailto:info@vootfly.com" className="hover:text-white hover:underline underline-offset-4">
                info@vootfly.com
              </a>
            </li>
          </ul>
        </div>

        <nav aria-label="Flights">
          <h3 className={heading}>Flights</h3>
          <ul className="mt-3 space-y-1 text-sm text-navy-foreground/85">
            <li><Link to="/flights/" className={linkClass}>Flights</Link></li>
            <li><Link to="/" hash="popular-routes" className={linkClass}>Popular Routes</Link></li>
            <li><Link to="/flights-from/" className={linkClass}>Departure Cities</Link></li>
            <li><Link to="/airlines/" className={linkClass}>Airlines</Link></li>
            <li><Link to="/research/fare-index" className={linkClass}>Fare Index</Link></li>
          </ul>
        </nav>

        <nav aria-label="Explore">
          <h3 className={heading}>Explore</h3>
          <ul className="mt-3 space-y-1 text-sm text-navy-foreground/85">
            <li><Link to="/flights-to/" className={linkClass}>Destinations</Link></li>
            <li><Link to="/flights-from/" className={linkClass}>Travel Guides</Link></li>
            <li><Link to="/flights-to/" className={linkClass}>Deals</Link></li>
            <li><Link to="/" hash="faq" className={linkClass}>FAQ</Link></li>
          </ul>
        </nav>

        <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-8 sm:col-span-1 sm:grid-cols-1">
          <nav aria-label="Company">
            <h3 className={heading}>Company</h3>
            <ul className="mt-3 space-y-1 text-sm text-navy-foreground/85">
              <li><Link to="/about" className={linkClass}>About</Link></li>
              <li><Link to="/contact" className={linkClass}>Contact</Link></li>
              <li><a href="mailto:support@vootfly.com" className={linkClass}>Support</a></li>
              <li><Link to="/sitemap" className={linkClass}>Sitemap</Link></li>
            </ul>
          </nav>
          <nav aria-label="Legal">
            <h3 className={heading}>Legal</h3>
            <ul className="mt-3 space-y-1 text-sm text-navy-foreground/85">
              <li><Link to="/privacy" className={linkClass}>Privacy Policy</Link></li>
              <li><Link to="/terms" className={linkClass}>Terms</Link></li>
              <li><Link to="/privacy" hash="cookies" className={linkClass}>Cookie Policy</Link></li>
              <li><Link to="/refund-policy" className={linkClass}>Refund Policy</Link></li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <p className="text-xs leading-relaxed text-navy-foreground/70">
            Disclaimer: VootFly is an Independent Online Travel Agency Portal. We
            Are Not Working With Any Association, Subsidiary and Third Party Support. All fares,
            airline names and logos displayed are for reference purposes only and remain the property
            of their respective owners.
          </p>
          <p className="mt-3 text-xs text-navy-foreground/75">
            © Copyright VootFly 2026. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
