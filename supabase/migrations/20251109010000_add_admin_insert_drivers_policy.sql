-- Ensure admin can insert drivers
-- This migration adds the missing INSERT policy for admins on the drivers table

-- Drop policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS admin_insert_all_drivers ON public.drivers;

-- Create policy for admin to insert drivers
CREATE POLICY admin_insert_all_drivers ON public.drivers
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

