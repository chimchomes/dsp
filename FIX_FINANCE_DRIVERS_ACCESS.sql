-- ============================================
-- COMPREHENSIVE FIX: Finance Driver Access
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Step 1: Verify finance role exists in enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'finance' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finance';
    RAISE NOTICE 'Added finance to app_role enum';
  ELSE
    RAISE NOTICE 'Finance role already exists in enum';
  END IF;
END $$;

-- Step 2: Drop existing finance policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Finance can view active drivers" ON public.drivers;
DROP POLICY IF EXISTS "Finance can view drivers for payroll" ON public.drivers;
DROP POLICY IF EXISTS "Finance can view limited driver info" ON public.drivers;

-- Step 3: Create the finance policy (matching admin policy pattern)
CREATE POLICY "Finance can view active drivers" ON public.drivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'finance'::app_role
  )
  AND (active = true OR active IS NULL)
);

-- Step 4: Verify the policy was created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'drivers'
    AND policyname = 'Finance can view active drivers';
  
  IF policy_count > 0 THEN
    RAISE NOTICE 'SUCCESS: Finance policy created successfully';
  ELSE
    RAISE EXCEPTION 'ERROR: Policy was not created';
  END IF;
END $$;

-- Step 5: Add comment
COMMENT ON POLICY "Finance can view active drivers" ON public.drivers IS 
'Allows finance users to view active drivers (active=true OR active IS NULL) for payroll, pay rates, invoices, and payslip management';

-- Step 6: Show current policies on drivers table
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END AS has_using
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'drivers'
ORDER BY policyname;

-- Step 7: Test query (shows what a finance user should see)
-- This will only work if you're logged in as a finance user
SELECT 
  COUNT(*) as total_drivers_visible,
  COUNT(*) FILTER (WHERE active = true) as active_true,
  COUNT(*) FILTER (WHERE active IS NULL) as active_null,
  COUNT(*) FILTER (WHERE active = false) as active_false
FROM public.drivers;
