-- Fix RLS policies for invoices, weekly_pay, daily_pay tables
-- Add WITH CHECK clauses and use has_role() function for consistency

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and Finance can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins and Finance can manage weekly pay" ON public.weekly_pay;
DROP POLICY IF EXISTS "Admins and Finance can manage daily pay" ON public.daily_pay;

-- Recreate invoices policy with WITH CHECK
CREATE POLICY "Admins and Finance can manage invoices"
  ON public.invoices
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  );

-- Recreate weekly_pay policy with WITH CHECK
CREATE POLICY "Admins and Finance can manage weekly pay"
  ON public.weekly_pay
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  );

-- Recreate daily_pay policy with WITH CHECK
CREATE POLICY "Admins and Finance can manage daily pay"
  ON public.daily_pay
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  );
