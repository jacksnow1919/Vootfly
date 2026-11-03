# VOOTFLY

Act as an expert React & Tailwind developer. Build a complete 3-page Online Travel Agency (OTA) web application named 'Business Class Deal' specializing in luxury flights. Use a mobile-first approach that scales perfectly to desktop.

1. Global Architecture, Styling & Viewport:

   - Framework: React with Tailwind CSS.

   - Palette: Luxury Dark Navy (`#0B1736`) for headers/hero, Pure White (`#FFFFFF`) for cards, Gold/Bronze (`#D97706`) for primary CTA buttons, and Muted Blue for secondary accents.

   - Above-the-Fold Constraint: Strictly apply `min-h-[100dvh]` (Dynamic Viewport Height) to the main layout wrappers on the Homepage. The hero text, search widget, and primary CTA must be 100% visible on the first view for both mobile phones and laptops without requiring the user to scroll.

   - Top Global Bar: Display badges: "★ Best Price Guarantee", "🔒 Verified Secure Booking", "📦 No Hidden Booking Fees", "📞 24/7 Assistance".

   - Header Navigation: Brand logo on the left, nav links (Flights, Airlines, Deals) centered, and a prominent "+1-844-362-5118" Gold CTA on the right.

2. Page 1: Homepage (`/`):

   - Hero Section (`flex flex-col justify-center h-[calc(100dvh-4rem)]`): 

     - Include a gold badge "★ EXCLUSIVE UNPUBLISHED FARES".

     - Bold headline: "Business Class Flights Upto 60% Off".

     - Search Widget: Compact tab bar (Round Trip / One Way). Inline input fields for Origin, Destination, Dates, and Passengers. Include a highly visible, full-width (on mobile) Gold "Find My Deal" CTA button.

   - Trust Bar: Anchor a stats row at the absolute bottom of the 100dvh viewport featuring: "4.9 on Trustpilot", "90% Customer Return Ratio", "47+ Partner Airlines", "20,000+ Flights Booked".

   - Floating Elements: Add a bottom-right floating badge "📞 24/7 FREE CALL BACK" and an interactive "✦ Ask AI for Unpublished Business Class Deals" floating bar.

3. Page 2: Search Results (`/flight/search`):

   - Header Summary: Sticky top bar showing route details (e.g., "JFK - MIA | Adult- 1 | 19 Aug 26").

   - Layout: Two-column grid on desktop (Sidebar filters on the left, Flight matrix/cards on the right). Stacked on mobile.

   - Sidebar Filters: Options for Stopovers, Price Range slider, Departure Time slots, and Airline checkboxes.

   - Flight Cards: Detailed cards displaying Airline logo, Departure/Arrival times, duration, flight number, and cabin allowance. Must prominently display "Price Per Person includes taxes & fees", the total price, and a Gold "Select" button that routes to `/flight/booking`.

4. Page 3: Booking & Checkout (`/flight/booking`) - (CRITICAL HANDOFF ROUTE):

   - Deep-Link Parsing: Implement React Router's `useSearchParams` to actively capture incoming URL parameters from affiliate meta-search engines. The page MUST listen for: `?origin=`, `?destination=`, `?departDate=`, `?airline=`, `?flightNo=`, `?cabin=`, `?currency=`, and `?price=`.

   - Layout: Left column for Passenger Forms. Right column for a sticky "Trip Summary" sidebar.

   - Left Column (Forms): Traveller Information Form (Title, First/Last Name, DOB, Gender), Contact Details Form (Email, Phone), and a dummy Payment UI.

   - Right Column (Trip Summary): This sidebar MUST dynamically display the exact `price`, `currency`, `cabin`, `origin`, and `airline` pulled from the URL parameters to ensure flawless price parity with the referring site. 

   - Final CTA: Include a bold "Secure Price Guarantee" checkout button displaying the dynamic URL price.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vootfly.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/83da1e6a-7cce-427a-b07f-ce100bf535dd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
