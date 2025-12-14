-- Fix route assignment and driver route viewing
-- 1. Ensure route-admins can UPDATE routes to assign drivers
-- 2. Fix driver route viewing to use user_id instead of email (more reliable)
-- 3. Ensure drivers can see their assigned routes

-- Drop existing route update policies
DROP POLICY IF EXISTS "Drivers can update their own routes" ON public.routes;
DROP POLICY IF EXISTS "Dispatchers can update routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and dispatchers can update routes" ON public.routes;

-- Policy 1: Drivers can update their own assigned routes (status, completion details, etc.)
CREATE POLICY "Drivers can update their own routes"
ON public.routes
FOR UPDATE
USING (
  driver_id IS NOT NULL AND
  driver_id IN (
    SELECT id FROM public.drivers 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  driver_id IS NOT NULL AND
  driver_id IN (
    SELECT id FROM public.drivers 
    WHERE user_id = auth.uid()
  )
);

-- Policy 2: Admins and route-admins can update all routes (including assigning drivers)
CREATE POLICY "Admins and route-admins can update all routes"
ON public.routes
FOR UPDATE
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

-- Fix driver route viewing to use user_id instead of email (more reliable and avoids recursion)
DROP POLICY IF EXISTS "Drivers can view their own routes" ON public.routes;

CREATE POLICY "Drivers can view their own routes"
ON public.routes
FOR SELECT
USING (
  driver_id IS NOT NULL AND
  driver_id IN (
    SELECT id FROM public.drivers 
    WHERE user_id = auth.uid()
  )
);

-- Ensure the admin/route-admin view policy exists (using direct EXISTS to avoid recursion)
DROP POLICY IF EXISTS "Admins and dispatchers can view all routes" ON public.routes;
DROP POLICY IF EXISTS "Admins and route-admins can view all routes" ON public.routes;
CREATE POLICY "Admins and route-admins can view all routes"
ON public.routes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin'::app_role OR role = 'route-admin'::app_role OR role = 'dispatcher'::app_role)
  )
);

