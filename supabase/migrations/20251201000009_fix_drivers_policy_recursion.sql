-- Fix infinite recursion in drivers RLS policy
-- The issue is caused by policy conflicts or circular references in has_role() function
-- This migration drops all conflicting policies and recreates them with direct queries

-- Drop ALL existing policies on drivers to start fresh (prevents conflicts)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'drivers'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.drivers', r.policyname);
  END LOOP;
END $$;

-- Policy 1: Drivers can view their own record (using user_id to avoid recursion)
CREATE POLICY read_own_driver ON public.drivers
FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Drivers can update their own record
CREATE POLICY update_own_driver ON public.drivers
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy 3: Admins can read all drivers (using direct EXISTS, NOT has_role() to avoid recursion)
CREATE POLICY admin_read_all_drivers ON public.drivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Policy 4: Admins can insert drivers
CREATE POLICY admin_insert_all_drivers ON public.drivers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Policy 5: Admins can update drivers
CREATE POLICY admin_update_all_drivers ON public.drivers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Policy 6: Route-admins can view all active drivers (using direct EXISTS, NOT has_role())
CREATE POLICY "route_admin_view_active_drivers" ON public.drivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'route-admin'::app_role
  )
  AND active = true
);

-- Note: All policies use direct EXISTS queries on user_roles table
-- This avoids recursion that can occur with has_role() function calls
-- PostgreSQL combines these policies with OR logic automatically

