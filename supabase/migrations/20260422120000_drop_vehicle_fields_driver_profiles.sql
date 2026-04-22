-- Remove vehicle summary fields from driver_profiles (no longer used in app)

ALTER TABLE public.driver_profiles
  DROP COLUMN IF EXISTS vehicle_registration_number,
  DROP COLUMN IF EXISTS vehicle_type,
  DROP COLUMN IF EXISTS vehicle_mileage;
