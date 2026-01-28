
-- RLS fix for new invoice schema

-- RLS for INVOICES (assuming invoice_view refers to public.invoices)
DROP POLICY IF EXISTS "Admins/Finance manage invoices v2" ON public.invoices;
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

-- RLS for WEEKLY_PAY
DROP POLICY IF EXISTS "Admins/Finance manage weekly pay v2" ON public.WEEKLY_PAY;
CREATE POLICY "Admins/Finance manage weekly pay v2"
ON public.WEEKLY_PAY
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
  -- Additional filtering can be added here if needed, e.g., by operator_id, tour_id
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);

-- RLS for DAILY_PAY_QTY
DROP POLICY IF EXISTS "Admins/Finance manage daily pay qty" ON public.DAILY_PAY_QTY;
CREATE POLICY "Admins/Finance manage daily pay qty"
ON public.DAILY_PAY_QTY
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
  -- Additional filtering can be added here if needed, e.g., by operator_id, tour_id
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);

-- RLS for DAILY_PAY_SUMMARY
DROP POLICY IF EXISTS "Admins/Finance manage daily pay summary" ON public.DAILY_PAY_SUMMARY;
CREATE POLICY "Admins/Finance manage daily pay summary"
ON public.DAILY_PAY_SUMMARY
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
  -- Additional filtering can be added here if needed, e.g., by operator_id, tour_id
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);

-- RLS for ADJUSTMENT_DETAIL
DROP POLICY IF EXISTS "Admins/Finance manage adjustment detail" ON public.ADJUSTMENT_DETAIL;
CREATE POLICY "Admins/Finance manage adjustment detail"
ON public.ADJUSTMENT_DETAIL
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
  -- Additional filtering can be added here if needed, e.g., by operator_id, tour_id
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);

-- RLS for ADJUSTMENT_SUMMARY
DROP POLICY IF EXISTS "Admins/Finance manage adjustment summary" ON public.ADJUSTMENT_SUMMARY;
CREATE POLICY "Admins/Finance manage adjustment summary"
ON public.ADJUSTMENT_SUMMARY
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
  -- Additional filtering can be added here if needed, e.g., by operator_id
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('admin','finance')
  )
);
