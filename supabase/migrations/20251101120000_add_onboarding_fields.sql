-- Add new columns for expanded onboarding form fields

-- Personal Details
ALTER TABLE public.onboarding_sessions
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS surname TEXT,
ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
ADD COLUMN IF NOT EXISTS address_line_3 TEXT,
ADD COLUMN IF NOT EXISTS post_code TEXT;

-- Driver's License Details
ALTER TABLE public.onboarding_sessions
ADD COLUMN IF NOT EXISTS drivers_license_number TEXT,
ADD COLUMN IF NOT EXISTS license_expiry_date DATE,
ADD COLUMN IF NOT EXISTS license_picture TEXT;

-- Right to Work Details
ALTER TABLE public.onboarding_sessions
ADD COLUMN IF NOT EXISTS national_insurance_number TEXT,
ADD COLUMN IF NOT EXISTS passport_upload TEXT,
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS passport_expiry_date DATE;

-- Vehicle Details (Own Vehicle)
ALTER TABLE public.onboarding_sessions
ADD COLUMN IF NOT EXISTS vehicle_registration_number TEXT,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS vehicle_mileage INTEGER;

-- Leased Vehicle Details
ALTER TABLE public.onboarding_sessions
ADD COLUMN IF NOT EXISTS leased_vehicle_type1 TEXT,
ADD COLUMN IF NOT EXISTS leased_vehicle_type2 TEXT,
ADD COLUMN IF NOT EXISTS leased_vehicle_type3 TEXT;

-- Identity Details
ALTER TABLE public.onboarding_sessions
ADD COLUMN IF NOT EXISTS photo_upload TEXT,
ADD COLUMN IF NOT EXISTS dvla_code TEXT,
ADD COLUMN IF NOT EXISTS dbs_check BOOLEAN DEFAULT FALSE;

-- Work Availability
ALTER TABLE public.onboarding_sessions
ADD COLUMN IF NOT EXISTS driver_availability TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.onboarding_sessions.first_name IS 'First name of the applicant';
COMMENT ON COLUMN public.onboarding_sessions.surname IS 'Surname of the applicant';
COMMENT ON COLUMN public.onboarding_sessions.drivers_license_number IS 'Driver license number';
COMMENT ON COLUMN public.onboarding_sessions.national_insurance_number IS 'UK National Insurance Number';
COMMENT ON COLUMN public.onboarding_sessions.vehicle_type IS 'Vehicle type: Custom, Long wheel base, or Extra long wheel base';
COMMENT ON COLUMN public.onboarding_sessions.driver_availability IS 'Driver availability: Full Time, Part Time, or Flexi (Same Day)';

