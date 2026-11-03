# Specialist Navigation + AI Concierge

## Pillar 1 — Navigation revamp

Header nav becomes four high-intent items plus the gold phone CTA:

- **Flights** → `/flight/search` (default, active state kept)
- **Unpublished Fares** → opens a modal, not a page: headline "Unlock private fares", fields for origin, destination, travel month, cabin, email, phone (optional). Submitting saves the lead and shows "Our desk will send your quote shortly."
- **Cabin Suites** → new `/cabin-suites` page showcasing premium products (Qatar Qsuite, Emirates Business Suite, Delta One, Singapore Business, ANA The Room, Lufthansa Business) each with cabin type, seat pitch/lie-flat, lounge/dining notes, "from" price and a CTA into search.
- **Corporate Desk** → new `/corporate` page for B2B/group/executive-assistant enquiries: value props (net fares, consolidated invoicing, 10+ passenger groups, dedicated agent) and an enquiry form (company, contact, seats/year, routes, email, phone).
- **Phone concierge** stays visible in the header on all breakpoints, plus the mobile drawer gets the same four links.

Existing `/airlines`, `/destinations`, `/deals` pages stay live for SEO but are removed from the header nav; the footer keeps links to them so no published URL breaks.

## Pillar 2 — Gemini concierge

Replaces the dummy "Ask AI" bar and homepage "Ask AI" tab.

- **Auth gate:** clicking Ask AI while signed out opens a modal — "Your personal 24/7 travel concierge" — with Google and email sign-in, then continues straight into the chat.
- **Chat page** `/concierge` (signed-in only): history sidebar listing past conversations with titles and dates, new-chat button, message thread, streaming replies, mobile drawer for the sidebar.
- **Memory:** `conversations` and `messages` tables tied to the signed-in user, so history returns on next login.
- **Backend:** a secure server function attaches a strict luxury-travel-agent system prompt (business/first class focus, quote via desk, never invent live fares, always offer the phone concierge), calls Gemini via Lovable AI, streams the answer back, and stores both sides of the turn.

## Technical notes

- New DB migration: `conversations` (user_id, title) and `messages` (conversation_id, role, content) with GRANTs, RLS scoped to `auth.uid()`, and an updated-at trigger on conversations. Also `fare_leads` (type: unpublished/corporate, route, email, phone, payload) — inserts allowed for anon and authenticated, reads restricted to admins.
- New files: `src/routes/cabin-suites.tsx`, `src/routes/corporate.tsx`, `src/routes/_authenticated/concierge.tsx`, `src/components/site/UnpublishedFaresModal.tsx`, `src/components/site/ConciergeGate.tsx`, `src/lib/concierge.functions.ts` (streaming chat server fn), `src/lib/leads.functions.ts`.
- Edited: `src/components/site/SiteHeader.tsx` (nav + drawer), `src/routes/index.tsx` (Ask AI bar and Ask AI tab route into the gate), `src/components/site/SiteFooter.tsx` (keeps legacy marketing links).
- AI calls go through Lovable AI (`LOVABLE_API_KEY`) with `google/gemini-3-pro-preview` — no key in the frontend. I'll provision the key if missing.
- Each new route gets its own head() metadata; `/concierge` is noindex.
