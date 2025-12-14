-- Step 1: Add route-admin to the enum
-- This must be in a separate migration file to ensure it's committed before use
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'route-admin' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE app_role ADD VALUE 'route-admin';
  END IF;
END $$;

