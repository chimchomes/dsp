ALTER TABLE public.daily_pay
  ADD COLUMN IF NOT EXISTS adhoc_scheduled_collections INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packet INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regular_delivery INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locker_parcel_delivery INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total INTEGER DEFAULT 0;
DELETE FROM public.daily_pay  WHERE invoice_number = '295697';
DELETE FROM public.weekly_pay WHERE invoice_number = '295697';
DELETE FROM public.invoices   WHERE invoice_number = '295697';
