# Fix: admin console session dropping immediately

## What's happening

The admin sign-in works, but the session cookie is not sent back on the next request, so the dashboard instantly shows "Session expired".

Cause (confirmed in the code): the admin session cookie is issued with `SameSite=Lax`. The Lovable preview renders your app inside an iframe on a different domain, and browsers refuse to send `Lax` cookies in that cross-site iframe context. The cookie is set, then never returned — which reads as "expired in a second". The recent dev-only change that made the cookie non-`Secure` makes this worse, because the preview is served over HTTPS.

This is a cookie-attribute problem, not a credentials or database problem.

## The fix

1. Issue the admin session cookie as cross-site-safe: `Secure` always on, `SameSite=None`, plus the partitioned flag so modern browsers keep it inside the preview iframe. Keep `httpOnly` and the 8-hour lifetime.
2. On the dashboard, check session status once on mount (`adminSessionStatus`) and only render the "Session expired" screen when the server actually reports no admin session — so a slow first request no longer flashes the expired screen.
3. Keep the sign-in redirect as-is, and after a successful login refetch the bookings query so the console fills immediately.

## Verification

Load the admin console the way you do — inside the preview iframe — sign in, reload, and navigate between the Overview / Reconciliation / PNR tabs to confirm the session survives. Also confirm the published URL still works, since it is not iframed.

## About EAZAIR

The two projects are completely separate apps with separate databases and separate deployments, so nothing done here changes EAZAIR, and nothing there changes this project. The only thing they share today is the flight API credentials and the `utm_source=EAZAIR` / `click_id` values EAZAIR passes when it redirects a customer into this checkout — that link keeps working unchanged.

If you want the same admin console behaviour in EAZAIR, say so and I can read how its admin auth is currently built and mirror this cookie fix there as a separate change in that project.

## Technical notes

- File: `src/lib/bookings.functions.ts` — `sessionConfig()` cookie options only.
- File: `src/routes/admin.dashboard.tsx` — session-status gate before rendering the expired state.
- No database migration, no schema change, no new secrets (`SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` already exist).
