# VootFly phase tracker

Updated 28 September 2026 | Month 0: 19 September 2026 | Prepared by: Emma Jackob

**34%** Capability coverage (Month 0 was 22%; 33.8% now) | **85/100** Capability quality (5 of 5 inputs measured) | **Phase 5** Current phase (21 of 40 items done overall) | **12 / 3** Route pages / indexed (London restored 28 Sep)

**Gate rule.** An item is Done only when it is built, verified live and running on its schedule. A phase closes when every item is Done, or deferred by a recorded owner decision.

## Why this differs from EazAir
- EazAir sends travellers to a partner to book. VootFly takes the booking itself, so booking, payment, revenue and add-ons are core work here (Phase 4), not excluded.
- The funnel ends at a confirmed, paid booking, not a partner click. Analytics QA reconciles booking requests, not clicks.
- Loyalty is a legitimate option for an OTA (EazAir removed rewards because it is a meta-search). It needs a decision, not deletion by default.
- Payments need internal sign-off first: processor, merchant account and PCI responsibility.

## Priority 0: resolved 28 Sep 2026: Advisor alert on every booking request
- Done when: Each request emails the advisor inbox within minutes with reference, route, price and traveller contact; proven with a real test request
- Where it stands: Live 28 Sep, every 5 minutes, to aureliantravels4@gmail.com until you name another inbox. Proven end to end on the live site with a labelled test request: found, emailed, marked alerted only after the send, no duplicate on the next run; test data deleted. Passport numbers and dates of birth are never included.

## What we need from you now
- n8n is paused on all sites until its monthly allowance resets or the plan is upgraded (Settings, Usage and plan). Upgrading needs internal sign-off.
- Note the new GitHub token's expiry date (90 days from 28 Sep) in your calendar; site changes stop when it lapses.
- Decide whether VootFly should have a public deals page listing real fare drops (3.2): it publishes specific fares, so it needs internal sign-off.
- Decide on a baggage data source for international fares (3.4, 3.5): the fare type decides whether a bag is included, and the supplier does not provide it.
- Sign in once at vootfly.com/admin with the owner login saved in the site settings (ADMIN_EMAIL and ADMIN_PASSWORD), check the new booking stages, and add advisor accounts (4.3).
- Pick one contact address: the confirmation page and traveller email use info@vootfly.com, the About page uses support@vootfly.com.
- Make one real test booking through vootfly.com (for example New York to London, economy): nobody has ever submitted the form, and this proves the whole chain, form, advisor alert, traveller email and admin queue, in one go.
- Search JFK to LHR in economy once and check that a Watch this fare card appears under the results (5.4).
- Decide on A/B testing (5.3): defer until traffic grows, as recommended.
- Confirm aureliantravels4@gmail.com is the right inbox for booking-request alerts, or name another (one field to change).
- Decide the daily publish cap (6.1). 108 scored routes are ready and the growth pipeline is off.
- Each morning: request indexing in Search Console for the not-indexed pages in the 08:00 email (9 today).
- Internal sign-off, when ready: payment processor and PCI (4.4), markup and commission rule (4.5), refund policy text (4.6).
- Loyalty: build a real programme, or remove the dashboard text (5.6).

## Phase 1: Measurement loop (6 of 6 done)
Closed 28 Sep 2026 (all 6 items done) | Needs: Nothing further.

| # | Item | Done when | Where it stands | Status |
|---|---|---|---|---|
| 1.1 | Analytics QA (agent 48) | Weekly run reconciles booking requests and fare watches in the database with Mixpanel and GA4, stored and emailed | Live 28 Sep, Mondays 08:00. The site now also sends its search and booking events to GA4 (it only sent them to Mixpanel before), with a guard that never sends emails, phones or names to Google. First run: MATCH, 0 booking requests and 0 fare watches in all sources, which proves the plumbing; the real test comes with real bookings. GA4 is compared from 5 Oct, once it has a full week. | Done |
| 1.2 | Security review (agent 46) | Weekly review of accounts, roles, staff console accounts, staff actions and sign-in activity, stored and emailed | Live 28 Sep, Mondays 09:00, from a database function only the server can run. First run: CLEAR (0 accounts, 0 role holders, 0 staff accounts, 0 staff actions). Flags new staff accounts, role holders and unusual password-reset activity. | Done |
| 1.3 | Metric history | Every check stores its result so a trend can be shown | Live 28 Sep: metric_snapshots table. Analytics QA, security review, weekly rankings, competitor presence, monthly demand and the scorecard all store each reading; coverage history seeded with the real figures (22.0, 31.2, 32.6, 33.2). Indexing history continues in the Google Sheet. | Done |
| 1.4 | Dashboard v1 and monthly scorecard | One view of coverage, quality and business numbers, emailed monthly | Live 28 Sep, on the 1st at 09:30. First scorecard: coverage 32.6% (22% at Month 0), quality 85/100 from 5 of 5 inputs; 310 visits, 19 searches, 0 bookings, 76 Google impressions and 9 clicks in 30 days. The 85 is flattered by a quiet month (QA and security score 100 partly because nothing happened); the real weak input is indexing at 25%. Daily email continues for page updates and indexing. | Done |
| 1.5 | Judgment flags trigger action | Stale pages rewritten automatically; pages sent to IndexNow; not-indexed pages listed for a manual Google request | Content drift monitor (Mondays 05:00) proven 21 Sep. On 28 Sep a failed rewrite took New York to London offline; fixed the same day so a live page now stays up when its rewrite fails, and the page was restored with the correct $545 fare, QA 100. IndexNow daily 06:30. | Done |
| 1.6 | Phase tracker | This document, plus a copy in the repo at docs/phase-tracker.md, updated every working session | Created 26 Sep. | Done |

## Phase 2: Outside world (5 of 5 done)
Closed 28 Sep 2026 (all 5 items done) | Needs: Nothing from you. Competitor tracking can use Brave Search through n8n, as EazAir did.

| # | Item | Done when | Where it stands | Status |
|---|---|---|---|---|
| 2.1 | SERP v1 (agent 41) | Weekly rank position per route page from Search Console, with the trend | Live 28 Sep, Mondays 07:30, read straight from Search Console so the 8-week trend is real from the first report. First reading, week of 14 to 20 Sep: 29 impressions, 8 clicks; 3 of 12 route pages seen in Google, Boston to London at position 4. | Done |
| 2.2 | Competitor agent, Tier 1 (agent 38) | Google Flights, Skyscanner, KAYAK and CheapOair tracked on VootFly's routes | Live 28 Sep, Mondays 07:45, one Brave Search (US) per live route. First run, 11 searches: Google Flights top 10 on all 11 (average position 1.5), Skyscanner 11, KAYAK 10 in the top 20, CheapOair 0; VootFly not in the top 20 yet. Emailed; week-by-week history waits on GitHub access. | Done |
| 2.3 | Market agent (agent 39) | Real demand and seasonality for the routes people want | Live 28 Sep, monthly on the 1st, from Mixpanel summary reports (the service account may not download raw events). First reading, 90 days: 19 searches by 3 people over 5 routes, 58% for routes with a page. With only 3 people, this is mostly the team's own testing: a baseline, not customer demand yet. | Done |
| 2.4 | AI visibility (agent 42) | VootFly checked monthly in AI answers with a fixed question set | In the portfolio Gemini check since 21 Sep. Baseline: named in 0 of 8. ChatGPT in Track A. | Done |
| 2.5 | Who outranks us | Competitor positions on VootFly's target searches | Delivered with 2.2: the top 3 per search and, once VootFly appears, every site above it. No paid data needed. | Done |

## Phase 3: Fare moat (4 of 7 done)
Closed 28 Sep 2026 by your decision: 4 of 7 done; 3.2, 3.4 and 3.5 deferred | Needs: Internal sign-off for a public deals page (3.2), and a baggage data source that says whether each fare includes a bag (3.4, 3.5).

| # | Item | Done when | Where it stands | Status |
|---|---|---|---|---|
| 3.1 | Fare detection (agent 23) | Drops, spikes, stale and impossible fares detected in fare history | Live 28 Sep. Drops and spikes (8% and $25), plus impossible fares: below 0.4x or above 3x a route's usual price is held back, so the page keeps its last good fare and the reading is flagged out of the history. Tested on real London prices: $545 and $1,400 publish, $120 and $2,900 are held. Stale pages (not refreshed in 9 days) reported. 6 of 12 routes have enough history to judge. | Done |
| 3.2 | Fare events feed other agents | Each real drop reaches travellers' price alerts and a public deals page, with the standard fare disclaimer | Price alerts live and proven. A public deals page would publish specific fares as promotions, which needs internal sign-off under your publishing rule; the weekly fare report already lists real drops internally. | Needs sign-off |
| 3.3 | Best deal per city (agent 24) | Weekly answer to where the best opportunity is from each origin | Live 28 Sep, Mondays 10:30, in the weekly fare report. First reading: from New York, London at $545, 25% below its usual $724; Boston to London at its usual price; Chicago to Rome 2% above; Seattle not yet enough history. | Done |
| 3.4 | Baggage data | Checked-bag fees read monthly from each airline's own site, each with its source link and check date | Withdrawn 28 Sep. The Delta and American fees stored on 26 Sep ($45) are US domestic fees, and every VootFly route is international, where Main Cabin usually includes the first bag and basic fares charge about $60 to $75 each way. The supplier does not say which fare type a price is, so no honest fee can be shown yet. | Open |
| 3.5 | True-cost comparison (agent 33) | Fares show "With 1 checked bag: $X" where a sourced, dated fee exists; nothing where it does not | Withdrawn 28 Sep with 3.4: Boston to London showed $811 with a bag, which was wrong either way ($766 if the bag is included, about $886 to $916 on a basic fare). Removed from all live pages and verified gone. Needs fare-type or baggage-allowance data per fare first. | Open |
| 3.6 | Airline pages (agent 25) | /airlines pages built only from airlines in real fare data | Live 22 Sep: 38 airlines, replacing fabricated pages. Old addresses redirect permanently. | Done |
| 3.7 | Fare re-check before booking (OTA) | Every booking request re-checks the live fare; a changed price must be confirmed by the traveller | Built and tested in September, before this tracker. | Done |

## Phase 4: Commerce core (OTA) (2 of 7 done)
Waiting on sign-off (2 of 7 done); Phase 5 started 29 Sep | Needs: One sign-in at /admin to confirm the booking queue and add advisors (4.3); internal sign-off for 4.4 to 4.6.

| # | Item | Done when | Where it stands | Status |
|---|---|---|---|---|
| 4.1 | Advisor alert on booking request | Each request emails the advisor inbox within minutes; proven with a real test request | Live 28 Sep, every 5 minutes (see Priority 0 above). | Done |
| 4.2 | Booking confirmation email to traveller | Reference, route, price, what happens next, and the standard fare disclaimer, sent on every request | Live 28 Sep, every 5 minutes. Proven end to end on the live site with a test request sent to your own inbox: found, emailed (sent as VootFly, replies to info@vootfly.com), marked only after sending, no duplicate; test deleted. Uses the site's standard fare disclaimer word for word. Test bookings and invalid addresses are never emailed. | Done |
| 4.3 | Advisor booking queue | Staff can see each request and move it through received, confirmed, paid, ticketed or cancelled | Stages live 28 Sep in the admin console: Received, Confirmed with traveller, Paid, Ticketed, Cancelled (replacing the template label Pending Ticketing); every change is logged and read by the weekly security review. Not yet proven: 0 staff accounts exist, and the console needs the owner login to open. | Partial |
| 4.4 | Payments (agent 35) | Real payment taken through an approved processor | Today an advisor arranges payment off-site and no card data is collected, which is correct until approved. Needs processor, merchant account and PCI ownership. | Needs sign-off |
| 4.5 | Revenue tracking (agent 36) | Markup and commission recorded on every booking | Columns exist on every booking and stay empty until the business rule is decided. | Needs sign-off |
| 4.6 | Refund and change policy | /refund-policy states the real policy | Page exists; the policy text needs sign-off before it can be treated as final. | Needs sign-off |
| 4.7 | Add-ons (agent 37) | Bags and seats sold with the booking | Deferred until a supplier supports it. The old fake add-on list was deleted 22 Sep. | Open |

## Phase 5: Growth OS (3 of 6 done)
Current phase (from 29 Sep): 3 of 6 done | Needs: One real test booking through the site; a decision on A/B testing (5.3).

| # | Item | Done when | Where it stands | Status |
|---|---|---|---|---|
| 5.1 | Funnel agent (agent 19) | Weekly report on search, results, fare selected, booking request, confirmed and paid, naming the biggest leak | Live 29 Sep, Mondays 08:30, 28-day window (weekly numbers are still too small): visits, searches, searches with flights, fare selected, booking page opened, booking requested, confirmed, paid; phone vs computer; price alerts by source. Names a leak only when 5 or more people reached the previous step. First reading: 344 visits, 19 searches, 2 fares selected, 27 booking page openings, 0 requests. Checked: the 27 openings were 7 people, mostly testing Indian routes on 2 to 17 Sep, and Mixpanel also shows 0 submissions, so no bookings are being lost. | Done |
| 5.2 | Conversion fixes (agent 17) | Fixes shipped against the leaks the funnel report finds | Shipped: stale pre-filled search dates fixed (28 Sep). Next candidates from 5.1: mark the team's own visits so the funnel shows real customers only, and record failed booking submissions so a broken form can never look like people simply leaving. Nobody has ever submitted the booking form, so the full chain is still unproven. | Partial |
| 5.3 | Experiment switch (agent 18) | Simple A/B testing with a significance check | Not built. At today's traffic (19 searches in 28 days) a test needing 300 results views per group would take about two and a half years to reach a verdict, so building it now would only measure noise. Recommend deferring until traffic grows; needs your decision. | Your decision |
| 5.4 | Activation (agent 20) | A price alert offered after a search, and measured | Live 29 Sep: after a search, a Watch this fare card appears when the route has a VootFly page (airports mapped to cities, e.g. JFK to New York), starting from the route's tracked lowest fare so a search on expensive dates can never trigger a false price-drop email. Every alert now records where it was offered; the funnel report shows alerts per 100 searches by source. Not yet seen in a browser. | Partial |
| 5.5 | Retention (agent 21) | Fare-drop emails from real checked fares | Live daily 09:00 (same as 3.2). 0 subscribers so far. | Done |
| 5.6 | Loyalty decision (OTA) | Either a real programme, or the loyalty text removed | Closed 29 Sep by your instruction to remove business-class template features: the dashboard's lounge-access loyalty tiers and wallet were removed. A real VootFly loyalty programme remains an option for later. | Done |

## Phase 6: Marketing OS (1 of 6 done)
Not started (gate) | Needs: Your daily publish cap (6.1).

| # | Item | Done when | Where it stands | Status |
|---|---|---|---|---|
| 6.1 | Route scaling | New real route pages publish on a schedule behind the QA gate | 12 pages live across New York, Boston, Chicago and Seattle. The growth pipeline (W2) is switched off and 108 scored routes are waiting on your publish cap. | Your decision |
| 6.2 | Content beyond routes (agent 8) | Airport and city guides built from real data, behind the facts-only QA gate | Real airline pages (3.6) and origin and destination hubs exist. No airport or city guides. | Partial |
| 6.3 | Public Fare Index | A research page built from real fare history, with its method | Live at /research/fare-index since 21 Sep, labelled as a snapshot until enough history exists for a trend. | Done |
| 6.4 | AEO: questions travellers ask (agent 7) | FAQs from real questions; answer-engine groundwork until there is enough data | 26 source-linked questions for 5 routes; Search Console question capture live (none yet). /llms.txt live 29 Sep (EazAir's idea): a plain summary for AI assistants listing every live route page, read from the database, with no prices. Question-based FAQs wait for real search data. | Partial |
| 6.5 | Member lifecycle emails (agent 15) | Welcome, alert confirmation and win-back emails | Not built. | Open |
| 6.6 | PR pitches (agent 11) | The Fare Index pitched to travel and business press | Not built. Needs weekly trend history in the Fare Index first. | Open |

## Phase 7: Orchestration (0 of 3 done)
Not started (gate); last on purpose | Needs: Nothing new. Reads what Phases 1 to 6 produce.

| # | Item | Done when | Where it stands | Status |
|---|---|---|---|---|
| 7.1 | Opportunity Engine | Every division submits opportunities scored on impact, revenue and effort | Not built. | Open |
| 7.2 | Agent router | Each opportunity assigned to the agent or person who acts on it | Not built. | Open |
| 7.3 | Hermes v1 (agent 49) | Weekly answer to what changed, why, and who acts | Not built. | Open |

## Track A
| # | Action | Owner | Status |
|---|---|---|---|
| A.1 | Google sign-in shows VootFly, not Lovable (Google Cloud branding and a real Client ID) | You | Deferred |
| A.2 | Claim VootFly social handles and link them from the site | You | Open |
| A.3 | Directory listings (no phone needed) | You | Open |
| A.4 | Add vootfly.com in Bing Webmaster Tools (import from Search Console) | You | Open |
| A.5 | ChatGPT AI visibility, reusing EazAir's workflow and question set | Claude | Open |
| A.6 | Baggage fees for the remaining airlines in VootFly's fare data | Claude | Open |
| A.7 | Confirm whether support is really 24/7 (footer and homepage say so) | You | Open |
| A.8 | About 37 em dashes in other pages' visible copy | Claude, on your go-ahead | Open |

## Deliberately not doing yet
Hotels, car rentals, visa and activities (the homepage shows Hotels and Car Rental as coming soon; they stay that way until flights are complete, per the plan); mass page generation; building agents for the count.

## Honest gap to the plan's targets
The plan asks for about 50% by December 2026 and 65% by March 2027. VootFly is at 33% today. Estimate on the same model: finishing the items that need no approval in Phases 1 to 3 and 5 to 6 reaches about 40%. Phase 4 sign-offs (payments and revenue) are the largest single lever and would bring it to about 50%. Reaching 65% by March also needs the growth pipeline running and a second person for outreach.

## Update log
- **28 Sep 2026** Phase 1 items 1.1 to 1.4 checked: they run for BCD, EazAir and Flyingscanner, not yet VootFly; Phase 2 started by your decision while GitHub access is restored. Competitor Tracker live (2.2 and 2.5 done). New York to London had been taken offline by a failed drift rewrite; rule fixed so live pages stay up, page restored at the real $545, QA 100. GitHub token rejected: site code changes blocked until renewed. GA4 read access granted (property 553749452) and proven with real data. Phase 2 closed: weekly ranking report (2.1) and monthly demand report (2.3) live and verified; two bugs in the demand report caught on its first run (it emailed 0 searches instead of 19) and fixed before scheduling. New GitHub token working (write access fixed). P0 resolved: booking-request alerts live every 5 minutes, proven end to end. Stale pre-filled search dates fixed. Phase 1 closed: GA4 now receives VootFly's events; Analytics QA (Mon 08:00), security review (Mon 09:00), metric history and monthly scorecard (1st, 09:30) live and verified with real runs. Coverage 33.2%, quality 85/100.
- **28 Sep 2026, evening** Phase 3: impossible-fare guard and weekly fare report live (3.1, 3.3 done; best deal now New York to London $545, 25% below usual). Found my own error: the true-cost baggage line added 26 Sep used US domestic fees on international routes (Boston to London showed $811, wrong either way); withdrawn from all pages the same hour and verified gone. Coverage 33.1%, slightly down, because that comparison no longer counts.
- **28 Sep 2026, night** Phase 3 closed by your decision (3.2, 3.4, 3.5 deferred; note: Duffel, now the main fare source, may supply fare type and baggage allowance). Phase 4 started: traveller confirmation email live and proven (4.2); real booking stages live in the admin console (4.3, awaiting a first staff sign-in). Coverage 33.4%.
- **29 Sep 2026** By your instruction, business-class template leftovers removed and good ideas from Way4Fly and EazAir added. Removed: a fare details page inventing lie-flat seats, lounge entry and refund fees that contradicted the real policy; a corporate page promising premium cabin fares; the business and first class AI concierge; dashboard loyalty tiers, wallet, invented concierge advice (including a false visa claim) and fake saved searches shown to every customer; unpublished-fare and premium-cabin wording in the refund policy, terms and privacy pages. Added: an About section on what the airline controls versus VootFly (Way4Fly's model) and /llms.txt (EazAir's). All verified live. Checked sister sites: VootFly's refund policy already matches Way4Fly's ($75 cancellation, $50 change fee).
- **29 Sep 2026, evening** Phase 5 started. Weekly funnel report live (5.1) and verified; its first leak (27 booking page openings, 0 requests) traced to 7 people, mostly team testing, with 0 submissions in Mixpanel too, so nothing is being lost; report wording made honest. Price alert offered after a search for routes with a page (5.4). Fake loyalty closed (5.6). Two more orphaned business-class components deleted. Coverage 33.8%.
- **29 Sep 2026, night** n8n’s monthly run limit was reached at about 10:00 India time; every scheduled workflow on every site has failed since (manual runs still work). 80% of runs were VootFly’s two booking workflows polling every 5 minutes with zero bookings, my design error. Fixed: the site now signals n8n when a booking is saved (secret-protected), with a 6-hour safety net: about 8 runs a day instead of 576. Needs the owner: check the reset date in n8n or approve an upgrade. The new signal and a real test booking can be verified once runs resume.
- **26 Sep 2026** Tracker created on the plan's phase order, adapted for an OTA. P0 found: booking requests notify nobody and 0 advisor accounts exist. True-cost baggage live on route pages (Delta, American). Motion logo live (homepage, search loading, 404). Daily email narrowed to page updates and indexing and moved to aureliantravels4@gmail.com; five live workflows re-published after finding their running versions were older than the tested drafts. Indexing 3 of 12.
- **22 Sep 2026** Fabricated airline, destination and route pages replaced with permanent redirects to real pages; the fake data file deleted. Trailing-slash redirect loop fixed on 38 of 46 sitemap addresses. New logo and full icon set. Homepage and About copy corrected; fake footer deal links removed.
- **21 Sep 2026** Fare refresh (W6) switched on after never having run; airline reference bug that blocked every fare observation fixed. Search Console writeback bug (every row silently dropped) fixed. Content drift monitor, price alert loop, SERP history, AEO questions and the Fare Index live. Chicago to Rome published.
- **19 Sep 2026** Month 0: first audit against the plan, 22% coverage.
