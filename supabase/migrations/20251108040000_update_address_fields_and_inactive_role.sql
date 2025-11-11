-- Update address fields to use address_line_1, address_line_2, address_line_3, postcode
-- Add inactive role to app_role enum
-- Implement active/inactive status logic

-- ============================================================================
-- 1. UPDATE ADDRESS FIELDS IN PROFILES TABLE
-- ============================================================================

-- Add new address columns if they don't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
ADD COLUMN IF NOT EXISTS address_line_3 TEXT,
ADD COLUMN IF NOT EXISTS postcode TEXT;

-- Migrate existing address data to address_line_1 if address column exists and has data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'address'
  ) THEN
    -- Copy existing address to address_line_1 if address_line_1 is empty
    UPDATE public.profiles
    SET address_line_1 = address
    WHERE address IS NOT NULL 
    AND address != ''
    AND (address_line_1 IS NULL OR address_line_1 = '');
  END IF;
END $$;

-- Keep the old address column for now (we'll drop it later after confirming migration works)
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS address;

-- ============================================================================
-- 2. ADD INACTIVE ROLE TO APP_ROLE ENUM
-- ============================================================================

-- Add 'inactive' role to app_role enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'inactive' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'inactive';
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE FUNCTION TO MANAGE DRIVER ACTIVE/INACTIVE STATUS
-- ============================================================================

-- Function to handle driver status changes and role management
CREATE OR REPLACE FUNCTION public.manage_driver_status()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_has_driver_role BOOLEAN;
  v_has_inactive_role BOOLEAN;
BEGIN
  -- Get user_id from drivers table
  v_user_id := NEW.user_id;

  -- Check if user has driver role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_user_id AND role = 'driver'
  ) INTO v_has_driver_role;

  -- Check if user has inactive role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_user_id AND role = 'inactive'
  ) INTO v_has_inactive_role;

  -- Handle INSERT case (new driver record)
  IF TG_OP = 'INSERT' THEN
    -- Treat NULL as active (true) - default behavior
    IF NEW.active = false THEN
      -- Driver is created as inactive
      -- Remove driver role if it exists
      DELETE FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'driver';
      
      -- Add inactive role
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'inactive')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      -- Driver is created as active (or NULL, which we treat as active)
      -- Ensure driver role exists
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'driver')
      ON CONFLICT (user_id, role) DO NOTHING;
      
      -- Remove inactive role if it exists
      DELETE FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'inactive';
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE case (existing driver record)
  -- Note: This only fires when active column changes (enforced by trigger WHEN clause)
  IF TG_OP = 'UPDATE' THEN
    -- If driver is being set to inactive (explicitly false)
    IF NEW.active = false THEN
      -- Remove driver role if it exists
      DELETE FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'driver';
      
      -- Add inactive role if it doesn't exist
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'inactive')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      -- Driver is being set to active (true or NULL)
      -- Remove inactive role if it exists
      DELETE FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'inactive';
      
      -- Add driver role if it doesn't exist
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'driver')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to automatically manage roles based on active status
-- Separate triggers for INSERT and UPDATE (TG_OP cannot be used in WHEN clause)

-- Trigger for INSERT (fires on all inserts)
DROP TRIGGER IF EXISTS driver_status_role_trigger_insert ON public.drivers;
CREATE TRIGGER driver_status_role_trigger_insert
  AFTER INSERT ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.manage_driver_status();

-- Trigger for UPDATE (only fires when active column changes)
DROP TRIGGER IF EXISTS driver_status_role_trigger_update ON public.drivers;
CREATE TRIGGER driver_status_role_trigger_update
  AFTER UPDATE OF active ON public.drivers
  FOR EACH ROW
  WHEN (OLD.active IS DISTINCT FROM NEW.active)
  EXECUTE FUNCTION public.manage_driver_status();

-- ============================================================================
-- 4. UPDATE ROLE_PROFILES VIEW TO INCLUDE NEW ADDRESS FIELDS
-- ============================================================================

-- Drop and recreate view to handle column structure changes
-- (Cannot use CREATE OR REPLACE when changing column structure significantly)
DROP VIEW IF EXISTS public.role_profiles CASCADE;

CREATE VIEW public.role_profiles AS
SELECT 
  ur.role,
  p.user_id,
  coalesce(p.full_name, trim(concat_ws(' ', p.first_name, p.surname))) as full_name,
  p.first_name,
  p.surname,
  p.email,
  p.address_line_1,
  p.address_line_2,
  p.address_line_3,
  p.postcode,
  p.contact_phone,
  p.emergency_contact_name,
  p.emergency_contact_phone
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id;

-- ============================================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN public.profiles.address_line_1 IS 'First line of address';
COMMENT ON COLUMN public.profiles.address_line_2 IS 'Second line of address (optional)';
COMMENT ON COLUMN public.profiles.address_line_3 IS 'Third line of address (optional)';
COMMENT ON COLUMN public.profiles.postcode IS 'Postal/ZIP code';

