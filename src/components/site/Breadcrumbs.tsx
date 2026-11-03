import { SITE_ORIGIN } from "@/lib/site-config";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { breadcrumbJsonLd, type Crumb } from "@/lib/hierarchy";

export function Breadcrumbs({ crumbs, className = "" }: { crumbs: Crumb[]; className?: string }) {
  if (!crumbs.length) return null;
  const jsonLd = breadcrumbJsonLd(crumbs, SITE_ORIGIN);
  return (
    <nav
      aria-label="Breadcrumb"
      className={`border-b border-border/60 pb-2 text-[13px] font-medium text-foreground/70 ${className}`}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.name}-${i}`} className="flex items-center gap-1.5">
              {c.path && !last ? (
                <Link to={c.path} className="hover:text-primary hover:underline">
                  {c.name}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "font-semibold text-navy" : ""}>
                  {c.name}
                </span>
              )}
              {!last ? <ChevronRight className="size-3.5 opacity-50" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
