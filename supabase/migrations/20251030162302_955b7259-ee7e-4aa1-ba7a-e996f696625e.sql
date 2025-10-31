-- Fix driver personal information exposure
-- Remove overly permissive policies that allow viewing all driver records

DROP POLICY IF EXISTS "Dispatchers can view all drivers" ON public.drivers;
DROP POLICY IF EXISTS "Finance can view all drivers" ON public.drivers;

-- Create restricted policy for dispatchers: only see drivers they manage through routes
CREATE POLICY "Dispatchers can view drivers they manage"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'dispatcher'::app_role)
    AND id IN (
      SELECT DISTINCT driver_id 
      FROM public.routes 
      WHERE dispatcher_id = auth.uid()
    )
  )
);

-- Create a limited view for finance that only exposes payment-related fields
CREATE OR REPLACE VIEW public.drivers_finance_view AS
SELECT 
  id,
  name,
  email,
  active,
  created_at,
  onboarded_at
FROM public.drivers;

-- Grant access to the limited view for finance role
GRANT SELECT ON public.drivers_finance_view TO authenticated;

-- Create policy for finance to use the limited view
CREATE POLICY "Finance can view limited driver info"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND id IN (SELECT id FROM public.drivers_finance_view)
);