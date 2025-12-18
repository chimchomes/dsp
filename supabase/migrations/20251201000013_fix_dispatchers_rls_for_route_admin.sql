-- Fix dispatchers RLS to allow route-admins to manage dispatchers
-- Update policies to use direct EXISTS queries instead of has_role() to avoid recursion
-- Route-admins need to be able to create, update, and delete dispatchers

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "Dispatchers can view dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "Route admins and dispatchers can view dispatchers" ON public.dispatchers;

-- Policy 1: Admins and route-admins can manage dispatchers (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Admins and route-admins can manage dispatchers"
ON public.dispatchers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin'::app_role OR role = 'route-admin'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin'::app_role OR role = 'route-admin'::app_role)
  )
);

-- Policy 2: Legacy dispatchers can view dispatchers (for backward compatibility)
CREATE POLICY "Legacy dispatchers can view dispatchers"
ON public.dispatchers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'dispatcher'::app_role
  )
);


