-- Allow authenticated users (including onboarding applicants) to list active tenants
-- for onboarding company selection.

DROP POLICY IF EXISTS "tenants_authenticated_active_read" ON public.tenants;

CREATE POLICY "tenants_authenticated_active_read" ON public.tenants
  FOR SELECT
  TO authenticated
  USING (status = 'active');
