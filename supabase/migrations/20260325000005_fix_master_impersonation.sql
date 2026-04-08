-- =============================================================================
-- Fix: Master Admin "View as Tenant" isolation
--
-- Problem: Master Admins have "see all" RLS policies. When they use 
-- "View as Tenant", the frontend queries still return data from ALL tenants
-- because the database doesn't know they want to be restricted.
--
-- Solution: 
-- 1. Create a helper to get an optional "impersonated" tenant ID from session.
-- 2. Update is_master_admin() to return FALSE if an impersonation is active
--    (unless we are on a system table like 'tenants').
-- 3. Update get_my_tenant_id() to prefer the impersonated ID.
-- =============================================================================

BEGIN;

-- Helper to get impersonated tenant ID from session setting 'app.current_tenant_id'
CREATE OR REPLACE FUNCTION public.get_impersonated_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

-- Update get_my_tenant_id to prefer impersonated ID
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    get_impersonated_tenant_id(),
    (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND tenant_id IS NOT NULL LIMIT 1)
  );
$$;

-- Update is_master_admin to return FALSE if impersonating
-- This forces the Master Admin to follow regular tenant RLS rules when "Viewing as"
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'master_admin'
  ) AND get_impersonated_tenant_id() IS NULL;
$$;

-- Special override for the 'tenants' table so Master Admin can still see the list 
-- to switch back, even while impersonating.
DROP POLICY IF EXISTS "tenants_master_all" ON public.tenants;
CREATE POLICY "tenants_master_all" ON public.tenants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'master_admin')
  ) 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'master_admin')
  );

COMMIT;
