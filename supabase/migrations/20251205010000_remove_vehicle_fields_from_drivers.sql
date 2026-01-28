-- Remove vehicle fields from drivers table
ALTER TABLE public.drivers 
  DROP COLUMN IF EXISTS vehicle_make,
  DROP COLUMN IF EXISTS vehicle_model,
  DROP COLUMN IF EXISTS vehicle_year,
  DROP COLUMN IF EXISTS vehicle_registration;
