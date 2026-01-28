-- Add RLS policy to allow HR to view all drivers
-- HR needs to view all drivers for management purposes

-- Allow HR to read all drivers
CREATE POLICY "HR can view all drivers"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'hr'
  )
);
