-- Final RLS fix for invoice ingestion:
-- Grants admin/finance (from user_roles) full access to invoices, weekly_pay, daily_pay.
-- Uses text comparison to avoid enum casting issues and includes WITH CHECK for inserts/updates.

-- Invoices
DROP POLICY IF EXISTS "Admins/Finance manage invoices v2" ON public.invoices;
DROP POLICY IF EXISTS "Admins/Finance can manage invoices" ON public.invoices;

CREATE POLICY "Admins/Finance manage invoices v2"
ON public.invoices
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);

-- Weekly Pay
DROP POLICY IF EXISTS "Admins/Finance manage weekly pay v2" ON public.weekly_pay;
DROP POLICY IF EXISTS "Admins and Finance can manage weekly pay" ON public.weekly_pay;

CREATE POLICY "Admins/Finance manage weekly pay v2"
ON public.weekly_pay
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);

-- Daily Pay
DROP POLICY IF EXISTS "Admins/Finance manage daily pay v2" ON public.daily_pay;
DROP POLICY IF EXISTS "Admins and Finance can manage daily pay" ON public.daily_pay;

CREATE POLICY "Admins/Finance manage daily pay v2"
ON public.daily_pay
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);
