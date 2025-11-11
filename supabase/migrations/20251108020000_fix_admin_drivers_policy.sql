-- Ensure admin can read all drivers
-- This migration ensures the admin_read_all_drivers policy exists

-- Drop policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS admin_read_all_drivers ON public.drivers;

-- Create policy for admin to read all drivers
CREATE POLICY admin_read_all_drivers ON public.drivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Also allow admin to update drivers
DROP POLICY IF EXISTS admin_update_all_drivers ON public.drivers;
CREATE POLICY admin_update_all_drivers ON public.drivers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

