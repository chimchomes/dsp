-- Fix security definer view issue
-- Drop the problematic view and create a simpler policy for finance

DROP VIEW IF EXISTS public.drivers_finance_view CASCADE;
DROP POLICY IF EXISTS "Finance can view limited driver info" ON public.drivers;

-- Create a direct policy for finance that allows viewing drivers for payroll purposes
-- Finance needs driver info for payroll processing, tax forms, and payment delivery
CREATE POLICY "Finance can view drivers for payroll"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND active = true
);