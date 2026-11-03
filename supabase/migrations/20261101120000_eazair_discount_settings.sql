-- EAZAIR Discount settings (1 Nov 2026). One row, managed from the admin "EAZAIR Discount" tab.
-- Controls the price VootFly quotes to EazAir: a markup per cabin plus an optional EazAir
-- discount. Ships switched OFF with every markup at 0, so live prices do not change on deploy.
-- Rollback: 20261101120000_eazair_discount_settings.rollback.sql
CREATE TABLE IF NOT EXISTS public.eazair_discount_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
  discount_value numeric NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  promo_code text NOT NULL DEFAULT 'EAZAIR',
  markup_economy numeric NOT NULL DEFAULT 0 CHECK (markup_economy >= 0 AND markup_economy <= 100),
  markup_premium_economy numeric NOT NULL DEFAULT 0 CHECK (markup_premium_economy >= 0 AND markup_premium_economy <= 100),
  markup_business numeric NOT NULL DEFAULT 0 CHECK (markup_business >= 0 AND markup_business <= 100),
  markup_first numeric NOT NULL DEFAULT 0 CHECK (markup_first >= 0 AND markup_first <= 100),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eazair_discount_pct_range CHECK (discount_type <> 'percentage' OR discount_value <= 100)
);
-- At most one settings row, ever: a second insert fails instead of creating a rival rule.
CREATE UNIQUE INDEX IF NOT EXISTS eazair_discount_settings_one_row
  ON public.eazair_discount_settings ((true));
GRANT ALL ON public.eazair_discount_settings TO service_role;
ALTER TABLE public.eazair_discount_settings ENABLE ROW LEVEL SECURITY;
-- No policies: only server code using the service role reads or writes this table.
-- One row, switched OFF, so nothing changes on deploy.
INSERT INTO public.eazair_discount_settings (is_active, discount_type, discount_value, promo_code)
SELECT false, 'percentage', 0, 'EAZAIR'
WHERE NOT EXISTS (SELECT 1 FROM public.eazair_discount_settings);
