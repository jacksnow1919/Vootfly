import { Phone } from "lucide-react";
import { track } from "@/lib/analytics";
import { ADVISOR_PHONE, ADVISOR_PHONE_TEL } from "@/components/home/HomeSections";

/**
 * Sticky "Talk to a VootFly Travel Advisor" call button (owner request, 1 Nov 2026).
 *
 * Not a pop-up: it is part of the page from the first paint (rendered on the server, no delay,
 * no animation), never covers the search form, and has nothing to dismiss.
 * Phones: a slim full-width bar fixed to the bottom of the screen. The page gets matching
 * bottom padding from the start, so the bar never hides the footer and nothing shifts (no CLS).
 * Tablet and desktop: a compact button in the bottom-right corner.
 */
export function AdvisorCallBar() {
  const onClick = () => track("Advisor Call Clicked", { placement: "sticky_bar" });
  return (
    <>
      <style>{`@media (max-width: 767px){body{padding-bottom:calc(56px + env(safe-area-inset-bottom))}}`}</style>
      <a
        href={`tel:${ADVISOR_PHONE_TEL}`}
        onClick={onClick}
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-center gap-2 bg-primary px-4 pb-[env(safe-area-inset-bottom)] text-sm font-bold text-primary-foreground shadow-[0_-4px_16px_rgba(10,26,51,0.12)] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white md:inset-x-auto md:bottom-5 md:right-5 md:h-12 md:rounded-full md:px-5 md:pb-0 md:shadow-[0_6px_20px_rgba(10,26,51,0.25)] md:hover:brightness-110"
      >
        <Phone className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="hidden sm:inline">Talk to a VootFly Travel Advisor: </span>
          <span className="sm:hidden">Talk to a VootFly advisor: </span>
          {ADVISOR_PHONE}
        </span>
      </a>
    </>
  );
}
