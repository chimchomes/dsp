-- UK format CHECK constraints (empty/null allowed; validate when provided)

-- Clear legacy dev/test values that do not match UK formats before adding constraints.
UPDATE public.onboarding_sessions
SET email = NULL
WHERE email IS NOT NULL AND email <> '' AND email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';

UPDATE public.onboarding_sessions
SET post_code = NULL
WHERE post_code IS NOT NULL AND post_code <> ''
  AND upper(regexp_replace(post_code, '\s+', '', 'g')) !~ '^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$';

UPDATE public.onboarding_sessions
SET contact_phone = NULL
WHERE contact_phone IS NOT NULL AND contact_phone <> ''
  AND regexp_replace(contact_phone, '[^0-9+]', '', 'g') !~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$';

UPDATE public.onboarding_sessions
SET emergency_contact_phone = NULL
WHERE emergency_contact_phone IS NOT NULL AND emergency_contact_phone <> ''
  AND regexp_replace(emergency_contact_phone, '[^0-9+]', '', 'g') !~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$';

UPDATE public.onboarding_sessions
SET drivers_license_number = NULL
WHERE drivers_license_number IS NOT NULL AND drivers_license_number <> ''
  AND upper(regexp_replace(drivers_license_number, '\s+', '', 'g')) !~ '^[A-Z9]{5}[0-9]{6}[A-Z0-9]{5}$';

UPDATE public.onboarding_sessions
SET national_insurance_number = NULL
WHERE national_insurance_number IS NOT NULL AND national_insurance_number <> ''
  AND upper(regexp_replace(national_insurance_number, '\s+', '', 'g'))
      !~ '^(?!BG|GB|NK|KN|TN|NT|ZZ)[ABCEGHJ-PRSTW-Z]{2}[0-9]{6}[A-D]$';

UPDATE public.onboarding_sessions
SET passport_number = NULL
WHERE passport_number IS NOT NULL AND passport_number <> ''
  AND regexp_replace(passport_number, '\s+', '', 'g') !~ '^[0-9]{9}$';

UPDATE public.onboarding_sessions
SET dvla_code = NULL
WHERE dvla_code IS NOT NULL AND dvla_code <> ''
  AND upper(regexp_replace(dvla_code, '\s+', '', 'g')) !~ '^[A-Z0-9]{8}$';

UPDATE public.driver_profiles
SET email = NULL
WHERE email IS NOT NULL AND email <> '' AND email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';

UPDATE public.driver_profiles
SET postcode = NULL
WHERE postcode IS NOT NULL AND postcode <> ''
  AND upper(regexp_replace(postcode, '\s+', '', 'g')) !~ '^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$';

UPDATE public.driver_profiles
SET contact_phone = NULL
WHERE contact_phone IS NOT NULL AND contact_phone <> ''
  AND regexp_replace(contact_phone, '[^0-9+]', '', 'g') !~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$';

UPDATE public.driver_profiles
SET emergency_contact_phone = NULL
WHERE emergency_contact_phone IS NOT NULL AND emergency_contact_phone <> ''
  AND regexp_replace(emergency_contact_phone, '[^0-9+]', '', 'g') !~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$';

UPDATE public.driver_profiles
SET license_number = NULL
WHERE license_number IS NOT NULL AND license_number <> ''
  AND upper(regexp_replace(license_number, '\s+', '', 'g')) !~ '^[A-Z9]{5}[0-9]{6}[A-Z0-9]{5}$';

UPDATE public.driver_profiles
SET national_insurance = NULL
WHERE national_insurance IS NOT NULL AND national_insurance <> ''
  AND upper(regexp_replace(national_insurance, '\s+', '', 'g'))
      !~ '^(?!BG|GB|NK|KN|TN|NT|ZZ)[ABCEGHJ-PRSTW-Z]{2}[0-9]{6}[A-D]$';

UPDATE public.driver_profiles
SET passport_number = NULL
WHERE passport_number IS NOT NULL AND passport_number <> ''
  AND regexp_replace(passport_number, '\s+', '', 'g') !~ '^[0-9]{9}$';

UPDATE public.driver_profiles
SET dvla_code = NULL
WHERE dvla_code IS NOT NULL AND dvla_code <> ''
  AND upper(regexp_replace(dvla_code, '\s+', '', 'g')) !~ '^[A-Z0-9]{8}$';

UPDATE public.staff_profiles
SET email = NULL
WHERE email IS NOT NULL AND email <> '' AND email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';

UPDATE public.staff_profiles
SET postcode = NULL
WHERE postcode IS NOT NULL AND postcode <> ''
  AND upper(regexp_replace(postcode, '\s+', '', 'g')) !~ '^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$';

UPDATE public.staff_profiles
SET contact_phone = NULL
WHERE contact_phone IS NOT NULL AND contact_phone <> ''
  AND regexp_replace(contact_phone, '[^0-9+]', '', 'g') !~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$';

UPDATE public.staff_profiles
SET emergency_contact_phone = NULL
WHERE emergency_contact_phone IS NOT NULL AND emergency_contact_phone <> ''
  AND regexp_replace(emergency_contact_phone, '[^0-9+]', '', 'g') !~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$';

-- onboarding_sessions
ALTER TABLE public.onboarding_sessions
  DROP CONSTRAINT IF EXISTS onboarding_sessions_email_format_chk,
  DROP CONSTRAINT IF EXISTS onboarding_sessions_post_code_format_chk,
  DROP CONSTRAINT IF EXISTS onboarding_sessions_contact_phone_format_chk,
  DROP CONSTRAINT IF EXISTS onboarding_sessions_emergency_contact_phone_format_chk,
  DROP CONSTRAINT IF EXISTS onboarding_sessions_drivers_license_format_chk,
  DROP CONSTRAINT IF EXISTS onboarding_sessions_ni_number_format_chk,
  DROP CONSTRAINT IF EXISTS onboarding_sessions_passport_number_format_chk,
  DROP CONSTRAINT IF EXISTS onboarding_sessions_dvla_code_format_chk;

ALTER TABLE public.onboarding_sessions
  ADD CONSTRAINT onboarding_sessions_email_format_chk
    CHECK (email IS NULL OR email = '' OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT onboarding_sessions_post_code_format_chk
    CHECK (
      post_code IS NULL OR post_code = ''
      OR upper(regexp_replace(post_code, '\s+', '', 'g')) ~ '^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$'
    ),
  ADD CONSTRAINT onboarding_sessions_contact_phone_format_chk
    CHECK (
      contact_phone IS NULL OR contact_phone = ''
      OR regexp_replace(contact_phone, '[^0-9+]', '', 'g') ~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$'
    ),
  ADD CONSTRAINT onboarding_sessions_emergency_contact_phone_format_chk
    CHECK (
      emergency_contact_phone IS NULL OR emergency_contact_phone = ''
      OR regexp_replace(emergency_contact_phone, '[^0-9+]', '', 'g') ~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$'
    ),
  ADD CONSTRAINT onboarding_sessions_drivers_license_format_chk
    CHECK (
      drivers_license_number IS NULL OR drivers_license_number = ''
      OR upper(regexp_replace(drivers_license_number, '\s+', '', 'g')) ~ '^[A-Z9]{5}[0-9]{6}[A-Z0-9]{5}$'
    ),
  ADD CONSTRAINT onboarding_sessions_ni_number_format_chk
    CHECK (
      national_insurance_number IS NULL OR national_insurance_number = ''
      OR upper(regexp_replace(national_insurance_number, '\s+', '', 'g'))
         ~ '^(?!BG|GB|NK|KN|TN|NT|ZZ)[ABCEGHJ-PRSTW-Z]{2}[0-9]{6}[A-D]$'
    ),
  ADD CONSTRAINT onboarding_sessions_passport_number_format_chk
    CHECK (
      passport_number IS NULL OR passport_number = ''
      OR regexp_replace(passport_number, '\s+', '', 'g') ~ '^[0-9]{9}$'
    ),
  ADD CONSTRAINT onboarding_sessions_dvla_code_format_chk
    CHECK (
      dvla_code IS NULL OR dvla_code = ''
      OR upper(regexp_replace(dvla_code, '\s+', '', 'g')) ~ '^[A-Z0-9]{8}$'
    );

-- driver_profiles
ALTER TABLE public.driver_profiles
  DROP CONSTRAINT IF EXISTS driver_profiles_email_format_chk,
  DROP CONSTRAINT IF EXISTS driver_profiles_postcode_format_chk,
  DROP CONSTRAINT IF EXISTS driver_profiles_contact_phone_format_chk,
  DROP CONSTRAINT IF EXISTS driver_profiles_emergency_contact_phone_format_chk,
  DROP CONSTRAINT IF EXISTS driver_profiles_license_number_format_chk,
  DROP CONSTRAINT IF EXISTS driver_profiles_ni_number_format_chk,
  DROP CONSTRAINT IF EXISTS driver_profiles_passport_number_format_chk,
  DROP CONSTRAINT IF EXISTS driver_profiles_dvla_code_format_chk;

ALTER TABLE public.driver_profiles
  ADD CONSTRAINT driver_profiles_email_format_chk
    CHECK (email IS NULL OR email = '' OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT driver_profiles_postcode_format_chk
    CHECK (
      postcode IS NULL OR postcode = ''
      OR upper(regexp_replace(postcode, '\s+', '', 'g')) ~ '^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$'
    ),
  ADD CONSTRAINT driver_profiles_contact_phone_format_chk
    CHECK (
      contact_phone IS NULL OR contact_phone = ''
      OR regexp_replace(contact_phone, '[^0-9+]', '', 'g') ~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$'
    ),
  ADD CONSTRAINT driver_profiles_emergency_contact_phone_format_chk
    CHECK (
      emergency_contact_phone IS NULL OR emergency_contact_phone = ''
      OR regexp_replace(emergency_contact_phone, '[^0-9+]', '', 'g') ~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$'
    ),
  ADD CONSTRAINT driver_profiles_license_number_format_chk
    CHECK (
      license_number IS NULL OR license_number = ''
      OR upper(regexp_replace(license_number, '\s+', '', 'g')) ~ '^[A-Z9]{5}[0-9]{6}[A-Z0-9]{5}$'
    ),
  ADD CONSTRAINT driver_profiles_ni_number_format_chk
    CHECK (
      national_insurance IS NULL OR national_insurance = ''
      OR upper(regexp_replace(national_insurance, '\s+', '', 'g'))
         ~ '^(?!BG|GB|NK|KN|TN|NT|ZZ)[ABCEGHJ-PRSTW-Z]{2}[0-9]{6}[A-D]$'
    ),
  ADD CONSTRAINT driver_profiles_passport_number_format_chk
    CHECK (
      passport_number IS NULL OR passport_number = ''
      OR regexp_replace(passport_number, '\s+', '', 'g') ~ '^[0-9]{9}$'
    ),
  ADD CONSTRAINT driver_profiles_dvla_code_format_chk
    CHECK (
      dvla_code IS NULL OR dvla_code = ''
      OR upper(regexp_replace(dvla_code, '\s+', '', 'g')) ~ '^[A-Z0-9]{8}$'
    );

-- staff_profiles (HR create path)
ALTER TABLE public.staff_profiles
  DROP CONSTRAINT IF EXISTS staff_profiles_email_format_chk,
  DROP CONSTRAINT IF EXISTS staff_profiles_postcode_format_chk,
  DROP CONSTRAINT IF EXISTS staff_profiles_contact_phone_format_chk,
  DROP CONSTRAINT IF EXISTS staff_profiles_emergency_contact_phone_format_chk;

ALTER TABLE public.staff_profiles
  ADD CONSTRAINT staff_profiles_email_format_chk
    CHECK (email IS NULL OR email = '' OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ADD CONSTRAINT staff_profiles_postcode_format_chk
    CHECK (
      postcode IS NULL OR postcode = ''
      OR upper(regexp_replace(postcode, '\s+', '', 'g')) ~ '^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$'
    ),
  ADD CONSTRAINT staff_profiles_contact_phone_format_chk
    CHECK (
      contact_phone IS NULL OR contact_phone = ''
      OR regexp_replace(contact_phone, '[^0-9+]', '', 'g') ~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$'
    ),
  ADD CONSTRAINT staff_profiles_emergency_contact_phone_format_chk
    CHECK (
      emergency_contact_phone IS NULL OR emergency_contact_phone = ''
      OR regexp_replace(emergency_contact_phone, '[^0-9+]', '', 'g') ~ '^(0[1-9][0-9]{8,9}|\+44[1-9][0-9]{8,9})$'
    );
