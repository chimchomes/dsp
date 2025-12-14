-- Allow route-admin to view all active drivers for route assignment
-- Route-admins need to see all drivers to assign routes, not just drivers they've already assigned routes to

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Dispatchers can view drivers they manage" ON public.drivers;

-- Create a simple policy for route-admins to view all active drivers
-- This avoids recursion by using a direct role check without complex subqueries
CREATE POLICY "Route-admins can view all active drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  -- Route-admins can see all active drivers (needed for route assignment)
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'route-admin'::app_role
  )
  AND active = true
);

-- Note: Admins are already covered by the admin_read_all_drivers policy
-- Legacy dispatchers will need to use a different approach or be migrated to route-admin

