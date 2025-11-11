-- Add Referential Integrity Constraints (FK & PK)
-- This migration ensures all user references have proper FK constraints
-- and enforces business rules via triggers

-- ============================================================================
-- 1. PROFILES TABLE - Add FK constraint if missing
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_user_id_fkey' 
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_user_id_fkey 
      FOREIGN KEY (user_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 2. DRIVERS TABLE - Add FK and UNIQUE constraints
-- ============================================================================

-- Ensure user_id column exists and is UUID type
ALTER TABLE public.drivers 
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Convert user_id to UUID if it's not already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drivers'
      AND column_name = 'user_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.drivers 
      ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
  END IF;
END $$;

-- Backfill user_id from auth.users by email (idempotent)
UPDATE public.drivers d
SET user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(d.email)
  AND (d.user_id IS DISTINCT FROM u.id OR d.user_id IS NULL);

-- Add UNIQUE constraint on user_id (one driver record per user)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_user_id_unique' 
    AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers 
      ADD CONSTRAINT drivers_user_id_unique 
      UNIQUE (user_id);
  END IF;
END $$;

-- Add FK constraint to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_user_id_fkey' 
    AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers 
      ADD CONSTRAINT drivers_user_id_fkey 
      FOREIGN KEY (user_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK constraint for onboarded_by (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drivers'
      AND column_name = 'onboarded_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'drivers_onboarded_by_fkey' 
    AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers 
      ADD CONSTRAINT drivers_onboarded_by_fkey 
      FOREIGN KEY (onboarded_by) 
      REFERENCES auth.users(id) 
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. ROUTES TABLE - Add FK constraint to drivers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'routes_driver_id_fkey' 
    AND conrelid = 'public.routes'::regclass
  ) THEN
    ALTER TABLE public.routes 
      ADD CONSTRAINT routes_driver_id_fkey 
      FOREIGN KEY (driver_id) 
      REFERENCES public.drivers(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4. EXPENSES TABLE - Add FK constraint to drivers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'expenses_driver_id_fkey' 
    AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses 
      ADD CONSTRAINT expenses_driver_id_fkey 
      FOREIGN KEY (driver_id) 
      REFERENCES public.drivers(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 5. INCIDENTS TABLE - Add FK constraint to drivers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'incidents_driver_id_fkey' 
    AND conrelid = 'public.incidents'::regclass
  ) THEN
    ALTER TABLE public.incidents 
      ADD CONSTRAINT incidents_driver_id_fkey 
      FOREIGN KEY (driver_id) 
      REFERENCES public.drivers(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 6. DRIVER_DOCUMENTS TABLE - Add FK constraint to drivers (if table exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'driver_documents'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_documents_driver_id_fkey' 
    AND conrelid = 'public.driver_documents'::regclass
  ) THEN
    ALTER TABLE public.driver_documents 
      ADD CONSTRAINT driver_documents_driver_id_fkey 
      FOREIGN KEY (driver_id) 
      REFERENCES public.drivers(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 7. DRIVER_TRAINING_PROGRESS TABLE - Add FK constraint to drivers (if table exists)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'driver_training_progress'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'driver_training_progress_driver_id_fkey' 
    AND conrelid = 'public.driver_training_progress'::regclass
  ) THEN
    ALTER TABLE public.driver_training_progress 
      ADD CONSTRAINT driver_training_progress_driver_id_fkey 
      FOREIGN KEY (driver_id) 
      REFERENCES public.drivers(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 8. NOTIFICATIONS TABLE - Add FK constraints to auth.users
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_sender_id_fkey' 
    AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications 
      ADD CONSTRAINT notifications_sender_id_fkey 
      FOREIGN KEY (sender_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_recipient_id_fkey' 
    AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications 
      ADD CONSTRAINT notifications_recipient_id_fkey 
      FOREIGN KEY (recipient_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 9. MESSAGES TABLE - Ensure FK constraints exist (should already exist, but verify)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_sender_id_fkey' 
    AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages 
      ADD CONSTRAINT messages_sender_id_fkey 
      FOREIGN KEY (sender_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_receiver_id_fkey' 
    AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages 
      ADD CONSTRAINT messages_receiver_id_fkey 
      FOREIGN KEY (receiver_id) 
      REFERENCES auth.users(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 10. ONBOARDING_SESSIONS TABLE - Ensure FK constraints exist
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'onboarding_sessions'
  ) THEN
    -- user_id FK
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'onboarding_sessions_user_id_fkey' 
      AND conrelid = 'public.onboarding_sessions'::regclass
    ) THEN
      ALTER TABLE public.onboarding_sessions 
        ADD CONSTRAINT onboarding_sessions_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
    END IF;

    -- reviewed_by FK (if column exists)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'onboarding_sessions'
        AND column_name = 'reviewed_by'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'onboarding_sessions_reviewed_by_fkey' 
      AND conrelid = 'public.onboarding_sessions'::regclass
    ) THEN
      ALTER TABLE public.onboarding_sessions 
        ADD CONSTRAINT onboarding_sessions_reviewed_by_fkey 
        FOREIGN KEY (reviewed_by) 
        REFERENCES auth.users(id) 
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 11. BUSINESS RULE TRIGGERS
-- ============================================================================

-- Trigger function: Ensure driver record requires 'driver' role
CREATE OR REPLACE FUNCTION public.enforce_driver_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id 
      AND role = 'driver'
    ) THEN
      RAISE EXCEPTION 'Driver record requires user to have driver role. User % does not have driver role.', NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS driver_role_check ON public.drivers;
CREATE TRIGGER driver_role_check
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_role();

-- Trigger function: Ensure onboarding session requires 'onboarding' role
CREATE OR REPLACE FUNCTION public.enforce_onboarding_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id 
      AND role = 'onboarding'
    ) THEN
      RAISE EXCEPTION 'Onboarding session requires user to have onboarding role. User % does not have onboarding role.', NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS onboarding_role_check ON public.onboarding_sessions;
CREATE TRIGGER onboarding_role_check
  BEFORE INSERT OR UPDATE ON public.onboarding_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_onboarding_role();

-- Trigger function: Ensure profile exists when user gets a role
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  SELECT NEW.user_id, u.email
  FROM auth.users u
  WHERE u.id = NEW.user_id
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS user_role_profile_check ON public.user_roles;
CREATE TRIGGER user_role_profile_check
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_profile_exists();

-- ============================================================================
-- 12. INDEXES for performance
-- ============================================================================

-- Index on drivers.user_id (if not exists)
CREATE INDEX IF NOT EXISTS drivers_user_id_idx ON public.drivers(user_id);

-- Index on notifications for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON public.notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

