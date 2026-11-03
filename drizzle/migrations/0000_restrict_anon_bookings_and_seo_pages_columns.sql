-- 1) Guest checkout goes through a trusted server handler (service role).
-- Anonymous clients must never touch bookings directly.
REVOKE ALL ON public.bookings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

CREATE POLICY "No anonymous access to bookings"
ON public.bookings
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2) seo_pages: hide internal fare snapshot / QA / indexing fields from public reads.
REVOKE ALL ON public.seo_pages FROM anon, authenticated;

GRANT SELECT (
  id, page_type, path, from_code, to_code, airline_slug, cabin, facet,
  meta_title, meta_description, content_json, status, legacy_slug,
  last_refreshed_at, created_at, updated_at
) ON public.seo_pages TO anon, authenticated;

GRANT ALL ON public.seo_pages TO service_role;