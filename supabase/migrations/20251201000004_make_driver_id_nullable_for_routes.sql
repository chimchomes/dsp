-- Make driver_id nullable in routes table to allow unassigned routes
-- This allows routes to be created before being assigned to a driver

ALTER TABLE public.routes
ALTER COLUMN driver_id DROP NOT NULL;

-- Update RLS policies to handle null driver_id
-- Routes with null driver_id should be visible to admins and dispatchers only
DROP POLICY IF EXISTS "Drivers can view their own routes" ON public.routes;

CREATE POLICY "Drivers can view their own routes"
ON public.routes FOR SELECT
USING (
  driver_id IS NOT NULL AND
  driver_id IN (
    SELECT id FROM public.drivers 
    WHERE email = auth.jwt()->>'email'
  )
);

-- Allow admins and dispatchers/route-admins to view all routes (including unassigned)
DROP POLICY IF EXISTS "Admins and dispatchers can view all routes" ON public.routes;
CREATE POLICY "Admins and dispatchers can view all routes"
ON public.routes FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role) OR
  has_role(auth.uid(), 'route-admin'::app_role)
);

-- Update insert policy to allow creating routes without driver_id
DROP POLICY IF EXISTS "Dispatchers can create routes" ON public.routes;
DROP POLICY IF EXISTS "Dispatchers and admins can create routes" ON public.routes;

CREATE POLICY "Dispatchers and admins can create routes"
ON public.routes FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role) OR
  has_role(auth.uid(), 'route-admin'::app_role)
);

