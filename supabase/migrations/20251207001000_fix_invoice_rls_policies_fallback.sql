-- Harden RLS for invoices, weekly_pay, daily_pay to allow finance/admin inserts.
-- Uses both has_role() and a direct user_roles text check with WITH CHECK.

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and Finance can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins and Finance can manage weekly pay" ON public.weekly_pay;
DROP POLICY IF EXISTS "Admins and Finance can manage daily pay" ON public.daily_pay;

-- Helper condition: allow admin/finance from user_roles (cast to text) or has_role()
-- This avoids enum mismatches and ensures WITH CHECK supports inserts.
CREATE POLICY "Admins and Finance can manage invoices"
ON public.invoices
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);

CREATE POLICY "Admins and Finance can manage weekly pay"
ON public.weekly_pay
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);

CREATE POLICY "Admins and Finance can manage daily pay"
ON public.daily_pay
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);
