# Navigation Clean-Up + Header Feature Workflows

## 1. Mobile drawer mirrors the public menu

Remove the Dashboard and Agent Portal links from the mobile drawer. The drawer becomes exactly:
Flights, Unpublished Fares, Cabin Suites, Corporate Desk, Ask AI Concierge, Sign In, Call button.

## 2. Flights goes to the homepage search widget

"Flights" in both the desktop header and the mobile drawer now goes to `/` and scrolls the flight search widget into view, focusing the Origin field (works both from another page and when already on the homepage).

## 3. Unpublished Fares modal

The modal keeps its fields (Origin, Destination, Travel Month, Cabin defaulting to Business, Email, Phone) and saves the lead as today. Two changes:

- Success state text becomes: "Quote Requested! A dedicated luxury agent will contact you within 15 minutes with unpublished rates." (phone CTA stays below it).
- The modal accepts an optional pre-filled note, so it can be opened from a cabin card with that suite pre-selected.

## 4. Cabin Suites card actions

- **Search this cabin** no longer jumps straight to JFK → MIA. It opens a small route modal titled "Where would you like to fly in Qatar Qsuite?" (suite name inserted) with Origin, Destination and Departure Date. "Find Qsuite Flights" routes to `/flight/search` with origin, destination, date, `cabin` matching the suite's cabin, and `airline` set to the carrier code (QR, EK, SQ, NH, DL, LH). The search page gains an optional `airline` parameter and pre-filters results to that carrier, showing a removable "Qatar Airways only" chip so travellers can widen the search.
- **Ask the desk** now opens the Unpublished Fares modal with the airline/product pre-filled in the notes, instead of dialling the phone. The 24/7 phone stays available in the header and inside the modal.

## 5. Corporate Desk B2B capture

The `/corporate` page keeps its value props but the form becomes the B2B set: Company Name, Contact Person, Work Email, Phone, Estimated monthly flight spend, Group size, plus optional routes/notes. Submissions save to a new `corporate_leads` table so the sales desk can work high-ticket enquiries separately from route quotes. Same submit-then-confirm behaviour, with a phone CTA in the confirmation.

## 6. Ask AI Concierge

The current behaviour already matches the requirement: signed-out users get the "Sign in to access your personal 24/7 travel concierge" gate modal, signed-in users go to the concierge chat with saved history. One addition: after signing in from the gate, the user lands on the concierge instead of the homepage. The chat lives at `/concierge`; if you'd prefer the URL to be `/chat`, say so and I'll add that path.

## Technical notes

- New table `public.corporate_leads` (company, contact_name, email, phone, monthly_spend, group_size, routes, notes) with GRANTs, RLS: anyone may insert, only admins may read. Requires a migration approval before the form is wired.
- Edits: `src/components/site/SiteHeader.tsx` (drawer items, Flights target), `src/routes/index.tsx` (focus target id on the search widget), `src/components/site/UnpublishedFaresModal.tsx` (prefill note + new success copy), `src/routes/cabin-suites.tsx` (route modal + desk action), `src/routes/flight.search.tsx` (optional `airline` param + filter chip), `src/routes/corporate.tsx` (B2B fields), new `src/components/site/CabinRouteModal.tsx`, and a small shared hook for opening the fares modal from any page.
- Airline pre-filter uses the IATA carrier code already returned by the fare mapper, so no API change is needed.
