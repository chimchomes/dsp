-- Add policy for finance users to view active drivers
-- This was dropped in migration 20251201000009_fix_drivers_policy_recursion.sql
-- Finance needs to view drivers for pay rates, invoices, and payslips

CREATE POLICY "Finance can view active drivers" ON public.drivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'finance'::app_role
  )
  AND (active = true OR active IS NULL)
);

COMMENT ON POLICY "Finance can view active drivers" ON public.drivers IS 
'Allows finance users to view active drivers for payroll, pay rates, invoices, and payslip management';
