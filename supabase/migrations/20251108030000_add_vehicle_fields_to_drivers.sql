-- Add vehicle and license expiry fields to drivers table
-- These fields are needed when drivers are created from onboarding sessions

ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS license_expiry DATE,
ADD COLUMN IF NOT EXISTS vehicle_make TEXT,
ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
ADD COLUMN IF NOT EXISTS vehicle_year INTEGER,
ADD COLUMN IF NOT EXISTS vehicle_registration TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.drivers.license_expiry IS 'Driver license expiry date';
COMMENT ON COLUMN public.drivers.vehicle_make IS 'Vehicle make (e.g., Toyota, Ford)';
COMMENT ON COLUMN public.drivers.vehicle_model IS 'Vehicle model (e.g., Camry, F-150)';
COMMENT ON COLUMN public.drivers.vehicle_year IS 'Vehicle year';
COMMENT ON COLUMN public.drivers.vehicle_registration IS 'Vehicle registration number';

