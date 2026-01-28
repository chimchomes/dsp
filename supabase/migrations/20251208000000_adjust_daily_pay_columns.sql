-- Align daily_pay with aggregated daily breakdown (Yodel invoice)
-- Adds category columns; keeps legacy columns to avoid data loss.

ALTER TABLE public.daily_pay
  ADD COLUMN IF NOT EXISTS adhoc_scheduled_collections INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packet INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regular_delivery INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locker_parcel_delivery INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total INTEGER DEFAULT 0;

-- Optional: if you want to remove legacy columns, uncomment below (do so only after confirming no needed data)
-- ALTER TABLE public.daily_pay DROP COLUMN IF EXISTS service_group;
-- ALTER TABLE public.daily_pay DROP COLUMN IF EXISTS qty;
-- ALTER TABLE public.daily_pay DROP COLUMN IF EXISTS rate;
-- ALTER TABLE public.daily_pay DROP COLUMN IF EXISTS amount;

