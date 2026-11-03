-- Rollback for 20261101120000_eazair_discount_settings.sql.
-- Removes the EAZAIR Discount settings. With the table gone, getEazairPricing() returns an
-- inactive discount and zero markup, and /api/meta/pricing-rule answers 503 rule_unavailable.
DROP TABLE IF EXISTS public.eazair_discount_settings;
