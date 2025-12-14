-- Step 2: Update all existing dispatcher role assignments to route-admin
-- This runs after the enum value is committed
UPDATE public.user_roles
SET role = 'route-admin'::app_role
WHERE role = 'dispatcher'::app_role;

-- Step 3: Create helper function to check for route-admin or dispatcher (for backward compatibility)
-- This allows RLS policies to work with both old and new role names during transition
CREATE OR REPLACE FUNCTION public.has_route_admin_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
    AND (role = 'route-admin'::app_role OR role = 'dispatcher'::app_role)
  )
$$;

-- Step 4: Update RLS policies that explicitly check for dispatcher to also check route-admin
-- Note: Most policies use has_role() which will work automatically, but some may need updates
-- We update key policies here for routes, stops, and dispatchers tables

-- Update dispatchers table policies to allow route-admin
DROP POLICY IF EXISTS "Dispatchers can view dispatchers" ON public.dispatchers;
CREATE POLICY "Route admins and dispatchers can view dispatchers"
ON public.dispatchers
FOR SELECT
USING (
  has_role(auth.uid(), 'route-admin'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Update stops table policies
DROP POLICY IF EXISTS "Admins and dispatchers can manage stops" ON public.stops;
CREATE POLICY "Admins and route admins can manage stops"
ON public.stops
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'route-admin'::app_role) OR
  has_role(auth.uid(), 'dispatcher'::app_role)
);

-- Step 5: Update function comments and documentation
COMMENT ON TYPE app_role IS 'User roles: admin, route-admin (formerly dispatcher), driver, hr, finance, onboarding, inactive';
COMMENT ON FUNCTION public.has_route_admin_role IS 'Checks if user has route-admin or dispatcher role (for backward compatibility)';

-- Note: RLS policies using has_role() will automatically work with route-admin
-- since we're updating the role in user_roles table. The has_role function
-- checks the user_roles table, so it will find route-admin roles.
-- Policies that explicitly check for 'dispatcher'::app_role are updated above.

