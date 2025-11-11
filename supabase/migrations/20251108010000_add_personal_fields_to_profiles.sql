-- Add personal information fields to profiles table
-- This aligns profiles table with the data model where profiles store personal info for all users

-- Add personal information columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Update role_profiles view to include new fields
CREATE OR REPLACE VIEW public.role_profiles AS
SELECT 
  ur.role,
  p.user_id,
  coalesce(p.full_name, trim(concat_ws(' ', p.first_name, p.surname))) as full_name,
  p.first_name,
  p.surname,
  p.email,
  p.contact_phone,
  p.address,
  p.emergency_contact_name,
  p.emergency_contact_phone
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id;

-- Migrate data from drivers table to profiles (for existing drivers)
-- This ensures drivers' personal info is in profiles table
UPDATE public.profiles p
SET 
  contact_phone = COALESCE(p.contact_phone, d.contact_phone),
  address = COALESCE(p.address, d.address),
  emergency_contact_name = COALESCE(p.emergency_contact_name, d.emergency_contact_name),
  emergency_contact_phone = COALESCE(p.emergency_contact_phone, d.emergency_contact_phone)
FROM public.drivers d
WHERE d.user_id = p.user_id
  AND d.user_id IS NOT NULL
  AND (
    p.contact_phone IS DISTINCT FROM d.contact_phone OR
    p.address IS DISTINCT FROM d.address OR
    p.emergency_contact_name IS DISTINCT FROM d.emergency_contact_name OR
    p.emergency_contact_phone IS DISTINCT FROM d.emergency_contact_phone
  );

-- Migrate data from onboarding_sessions to profiles (for users who completed onboarding)
UPDATE public.profiles p
SET 
  contact_phone = COALESCE(p.contact_phone, os.contact_phone),
  address = COALESCE(p.address, os.address),
  emergency_contact_name = COALESCE(p.emergency_contact_name, os.emergency_contact_name),
  emergency_contact_phone = COALESCE(p.emergency_contact_phone, os.emergency_contact_phone)
FROM public.onboarding_sessions os
WHERE os.user_id = p.user_id
  AND os.completed = true
  AND (
    p.contact_phone IS NULL OR
    p.address IS NULL OR
    p.emergency_contact_name IS NULL OR
    p.emergency_contact_phone IS NULL
  );

-- Add RLS policies for UPDATE on profiles (users can update their own profile)
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add RLS policy for HR/Admin to update profiles
DROP POLICY IF EXISTS profiles_admin_hr_update ON public.profiles;
CREATE POLICY profiles_admin_hr_update ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'hr')
    )
  );

