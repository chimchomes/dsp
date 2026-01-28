-- Fix driver_rates table schema to match code expectations
-- Add missing columns: driver_id and effective_date

-- Add driver_id column if it doesn't exist (UUID reference to drivers table)
-- Make it nullable initially in case there's existing data
ALTER TABLE public.driver_rates 
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE;

-- Add effective_date column if it doesn't exist
ALTER TABLE public.driver_rates 
  ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;

-- If there are existing rows with operator_id, try to populate driver_id from drivers table
-- This is optional and will only work if operator_id matches a driver's operator_id
UPDATE public.driver_rates dr
SET driver_id = d.id
FROM public.drivers d
WHERE dr.driver_id IS NULL 
  AND dr.operator_id IS NOT NULL 
  AND d.operator_id = dr.operator_id
  AND dr.driver_id IS NULL;

-- Now set default for effective_date if null
UPDATE public.driver_rates 
SET effective_date = CURRENT_DATE 
WHERE effective_date IS NULL;

-- Update unique constraint to include driver_id and effective_date
-- First drop the old constraint if it exists
ALTER TABLE public.driver_rates 
  DROP CONSTRAINT IF EXISTS driver_rates_operator_id_rate_id_key;

-- Drop the old unique constraint on operator_id if it exists with different name
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_rates_operator_id_rate_id_key'
  ) THEN
    ALTER TABLE public.driver_rates DROP CONSTRAINT driver_rates_operator_id_rate_id_key;
  END IF;
END $$;

-- Create new unique constraint with driver_id, rate_id, and effective_date
ALTER TABLE public.driver_rates 
  DROP CONSTRAINT IF EXISTS driver_rates_driver_rate_effective_unique;

ALTER TABLE public.driver_rates 
  ADD CONSTRAINT driver_rates_driver_rate_effective_unique 
  UNIQUE(driver_id, rate_id, effective_date);

-- Create index on driver_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_driver_rates_driver_id ON public.driver_rates(driver_id);

-- Create index on effective_date if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_driver_rates_effective_date ON public.driver_rates(effective_date);

-- Update RLS policy to use driver_id
DROP POLICY IF EXISTS "Drivers can view their own rates" ON public.driver_rates;
CREATE POLICY "Drivers can view their own rates" 
  ON public.driver_rates 
  FOR SELECT 
  USING (driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Add comments
COMMENT ON COLUMN public.driver_rates.driver_id IS 'Reference to driver record (UUID)';
COMMENT ON COLUMN public.driver_rates.effective_date IS 'Date when this rate becomes effective';
COMMENT ON COLUMN public.driver_rates.operator_id IS 'Legacy field - operator ID from invoice (can be null)';
