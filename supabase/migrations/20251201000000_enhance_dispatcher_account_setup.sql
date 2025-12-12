-- Part 1: Enhance dispatchers table with DispatcherAccount fields
-- Add new fields to dispatchers table for DispatcherAccount model
ALTER TABLE public.dispatchers
ADD COLUMN IF NOT EXISTS dsp_name TEXT,
ADD COLUMN IF NOT EXISTS driver_parcel_rate NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_deduction_rate NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tour_id_prefix TEXT;

-- Update existing records: use name as dsp_name if dsp_name is null
UPDATE public.dispatchers
SET dsp_name = name
WHERE dsp_name IS NULL;

-- Make dsp_name required (set NOT NULL after backfill)
ALTER TABLE public.dispatchers
ALTER COLUMN dsp_name SET NOT NULL;

-- Update driver_parcel_rate from rate_per_parcel if not set
UPDATE public.dispatchers
SET driver_parcel_rate = rate_per_parcel
WHERE driver_parcel_rate = 0 AND rate_per_parcel > 0;

-- Add index for tour_id_prefix lookups
CREATE INDEX IF NOT EXISTS idx_dispatchers_tour_id_prefix ON public.dispatchers(tour_id_prefix);

