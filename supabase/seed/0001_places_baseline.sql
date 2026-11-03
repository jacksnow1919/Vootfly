-- Baseline `places` seed for VootFly's pSEO hierarchy.
-- Applied directly to VootFly's Supabase via Lovable's database tool on
-- 2026-09-04 (not through drizzle -- drizzle/schema.ts is blank for this
-- project, so this file is a reproducibility record, not a runnable
-- migration). See docs/VOOTFLY-STRATEGY.md section 3.
--
-- IMPORTANT: `code`, `parent_code`, `country_code`, `iata` and `region` are
-- always lowercase. Every route loader in the app does `params.x.toLowerCase()`
-- before querying, so lowercase is the actual, load-bearing convention, not a
-- style preference. This file originally used uppercase codes, which passed
-- every check I ran at the time but made every published route page 404 in
-- production (the loader queries by lowercase, found nothing, threw notFound()).
-- Fixed directly in the live DB and in this file on 2026-09-04 -- see the git
-- history for src/lib/seo-pages.server.ts around the same date for the
-- matching code-side fix (the `code` Zod validator was briefly loosened to
-- accept uppercase while chasing a different bug, which is what let this slip
-- through; it's back to strict lowercase now).
--
-- 12 countries, 22 metros (10 US gateways + 12 international destinations),
-- 9 airport-level children for the multi-airport metros (NYC, Chicago,
-- London, Tokyo). Every other metro is single_airport=true with its IATA
-- code directly on the metro row.
--
-- This unblocks route pages (/flights/{from}/{to}/...), hub pages
-- (/flights-from/{code}, /flights-to/{code}), and the hub index pages --
-- all of which only require `places` rows to exist, not a `seo_pages` row.
-- Written route content (headings, intro copy, fare snapshots) still comes
-- from `seo_pages`, which stays empty until the n8n content pipeline is
-- replicated for VootFly (tracked as the next priority in the strategy doc).

insert into places (code, level, parent_code, name, slug_name, country_code, iata, region, is_us_gateway, single_airport, sort_order) values
-- countries
('us','country',null,'United States','united-states','us',null,null,false,false,1),
('gb','country',null,'United Kingdom','united-kingdom','gb',null,null,false,false,2),
('fr','country',null,'france','france','fr',null,null,false,false,3),
('ae','country',null,'United Arab Emirates','united-arab-emirates','ae',null,null,false,false,4),
('jp','country',null,'japan','japan','jp',null,null,false,false,5),
('sg','country',null,'Singapore','singapore-country','sg',null,null,false,false,6),
('th','country',null,'thailand','thailand','th',null,null,false,false,7),
('au','country',null,'Australia','australia','au',null,null,false,false,8),
('ca','country',null,'canada','canada','ca',null,null,false,false,9),
('it','country',null,'italy','italy','it',null,null,false,false,10),
('es','country',null,'spain','spain','es',null,null,false,false,11),
('in','country',null,'india','india','in',null,null,false,false,12),
-- US gateway metros
('nyc','metro','us','New York','new-york','us',null,null,true,false,1),
('lax','metro','us','Los Angeles','los-angeles','us','lax',null,true,true,2),
('chi','metro','us','Chicago','chicago','us',null,null,true,false,3),
('hou','metro','us','Houston','houston','us','iah',null,true,true,4),
('sfo','metro','us','San Francisco','san-francisco','us','sfo',null,true,true,5),
('sea','metro','us','Seattle','seattle','us','sea',null,true,true,6),
('mia','metro','us','Miami','miami','us','mia',null,true,true,7),
('bos','metro','us','Boston','boston','us','bos',null,true,true,8),
('was','metro','us','Washington D.C.','washington-dc','us','iad',null,true,true,9),
('dfw','metro','us','Dallas','dallas','us','dfw',null,true,true,10),
-- international destination metros
('lon','metro','gb','London','london','gb',null,'Europe',false,false,1),
('par','metro','fr','Paris','paris','fr','cdg','Europe',false,true,2),
('rom','metro','it','Rome','rome','it','fco','Europe',false,true,3),
('bcn','metro','es','Barcelona','barcelona','es','bcn','Europe',false,true,4),
('dxb','metro','ae','Dubai','dubai','ae','dxb','Middle East',false,true,5),
('tyo','metro','jp','Tokyo','tokyo','jp',null,'Asia',false,false,6),
('sin','metro','sg','Singapore','singapore','sg','sin','Asia',false,true,7),
('bkk','metro','th','Bangkok','bangkok','th','bkk','Asia',false,true,8),
('del','metro','in','Delhi','delhi','in','del','Asia',false,true,9),
('gox','metro','in','Goa','goa','in','gox','Asia',false,true,10),
('syd','metro','au','Sydney','sydney','au','syd','Oceania',false,true,11),
('yto','metro','ca','Toronto','toronto','ca','yyz','North America',false,true,12),
-- multi-airport metro children
('jfk','airport','nyc','John F. Kennedy International Airport','jfk-airport','us','jfk',null,true,false,1),
('ewr','airport','nyc','Newark Liberty International Airport','ewr-airport','us','ewr',null,true,false,2),
('lga','airport','nyc','LaGuardia Airport','lga-airport','us','lga',null,true,false,3),
('ord','airport','chi','O''Hare International Airport','ord-airport','us','ord',null,true,false,1),
('mdw','airport','chi','Midway International Airport','mdw-airport','us','mdw',null,true,false,2),
('lhr','airport','lon','Heathrow Airport','lhr-airport','gb','lhr','Europe',false,false,1),
('lgw','airport','lon','Gatwick Airport','lgw-airport','gb','lgw','Europe',false,false,2),
('nrt','airport','tyo','Narita International Airport','nrt-airport','jp','nrt','Asia',false,false,1),
('hnd','airport','tyo','Haneda Airport','hnd-airport','jp','hnd','Asia',false,false,2)
on conflict (code) do nothing;
