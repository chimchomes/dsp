-- Add explicit authentication requirement for drivers table
-- This is a RESTRICTIVE policy that requires authentication
-- in addition to the existing role-based policies

CREATE POLICY "Drivers table requires authentication"
ON public.drivers
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);