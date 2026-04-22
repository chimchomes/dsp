-- Align driver_profiles with onboarding_sessions: passport, DVLA, availability, document paths

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS passport_number TEXT,
  ADD COLUMN IF NOT EXISTS passport_expiry DATE,
  ADD COLUMN IF NOT EXISTS dvla_code TEXT,
  ADD COLUMN IF NOT EXISTS dbs_check BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS driver_availability TEXT,
  ADD COLUMN IF NOT EXISTS license_picture TEXT,
  ADD COLUMN IF NOT EXISTS passport_upload TEXT,
  ADD COLUMN IF NOT EXISTS photo_upload TEXT;

COMMENT ON COLUMN public.driver_profiles.license_picture IS 'Storage path in driver-documents bucket';
COMMENT ON COLUMN public.driver_profiles.passport_upload IS 'Storage path in driver-documents bucket';
COMMENT ON COLUMN public.driver_profiles.photo_upload IS 'Storage path in driver-documents bucket';
