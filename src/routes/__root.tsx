import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initAnalytics } from "../lib/analytics";
import { captureClickId } from "../lib/click-id";
import { SiteHeader } from "../components/site/SiteHeader";
import { SiteFooter } from "../components/site/SiteFooter";
import { RegionSettingsProvider } from "../lib/region-settings";


import { MotionLogo } from "@/components/site/MotionLogo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <MotionLogo className="mx-auto h-24 w-auto" />
        <h1 className="mt-2 text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VootFly — Cheap Flight Deals & Air Tickets Booking" },
      { name: "google-site-verification", content: "ZnYoYEy_ra3ThGkmsueqytln2-Ye5-XttUks98U4VJQ" },
      {
        name: "description",
        content:
          "Compare flight fares worldwide with VootFly and book with the help of an advisor.",
      },
      { property: "og:title", content: "VootFly — Cheap Flight Deals" },
      {
        property: "og:description",
        content: "Compare real flight fares and book with the help of a VootFly advisor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // Social share image built from the new logo (1200x630, logo + tagline).
      // Absolute URL because link-preview crawlers do not resolve relative
      // paths. Individual pages may still override with their own image.
      { property: "og:image", content: "https://www.vootfly.com/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "VootFly. Search. Compare. Travel." },
      { name: "twitter:image", content: "https://www.vootfly.com/og-image.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Self-hosted fonts (29 Oct 2026): preloaded so they usually arrive before
      // first paint; @font-face and metric-matched fallbacks live in styles.css.
      // Replaces the render-blocking Google Fonts stylesheet.
      { rel: "preload", href: "/fonts/plus-jakarta-sans-latin-wght-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/inter-latin-wght-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      // Favicon set, rebuilt 2026-09-22 from the new VootFly logo package
      // (public/brand/). ICO first for older browsers, SVG for modern ones
      // (sharp at any zoom), PNGs as fallback. The old favicon.png is removed.
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: [
      // Google tag (gtag.js) -- GA4 property G-SVEMV8T5N5. In head(), not a
      // useEffect, so it's present on the very first server-rendered
      // response and loads as early as Google recommends, rather than only
      // after client-side hydration (unlike initAnalytics()/Mixpanel below,
      // which is deliberately client-only). Runs alongside Mixpanel, not in
      // place of it -- two separate, independent analytics tools.
      { src: "https://www.googletagmanager.com/gtag/js?id=G-SVEMV8T5N5", async: true },
      {
        children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-SVEMV8T5N5');`,
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    captureClickId();
    // Mixpanel is loaded once the page has finished loading and the browser is
    // idle (29 Oct 2026, mobile PageSpeed), so it never competes with the first
    // render. It still records the page view, just a moment later.
    const start = () => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => initAnalytics(), { timeout: 4000 });
      else setTimeout(initAnalytics, 1500);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RegionSettingsProvider>
        <SiteHeader />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes.
            Wrapped in <main> (29 Oct 2026) so every page has one main landmark (accessibility). */}
        <main id="main-content">
          <Outlet />
        </main>
        <SiteFooter />
      </RegionSettingsProvider>
    </QueryClientProvider>
  );
}

