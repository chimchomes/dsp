-- Grant drivers read access to their own invoice breakdown data
-- so that driver-facing payslip pages can show the same details
-- as finance, without exposing other drivers' information.

-- WEEKLY_PAY: allow drivers to SELECT rows for their own operator_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'WEEKLY_PAY'
      AND policyname = 'Drivers can view their own WEEKLY_PAY'
  ) THEN
    CREATE POLICY "Drivers can view their own WEEKLY_PAY"
      ON public."WEEKLY_PAY"
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.user_id = auth.uid()
            AND d.operator_id = "WEEKLY_PAY".operator_id
        )
      );
  END IF;
END
$$;

-- DAILY_PAY_SUMMARY: allow drivers to SELECT rows for their own operator_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'DAILY_PAY_SUMMARY'
      AND policyname = 'Drivers can view their own DAILY_PAY_SUMMARY'
  ) THEN
    CREATE POLICY "Drivers can view their own DAILY_PAY_SUMMARY"
      ON public."DAILY_PAY_SUMMARY"
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.user_id = auth.uid()
            AND d.operator_id = "DAILY_PAY_SUMMARY".operator_id
        )
      );
  END IF;
END
$$;

-- ADJUSTMENT_DETAIL: allow drivers to SELECT rows for their own operator_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ADJUSTMENT_DETAIL'
      AND policyname = 'Drivers can view their own ADJUSTMENT_DETAIL'
  ) THEN
    CREATE POLICY "Drivers can view their own ADJUSTMENT_DETAIL"
      ON public."ADJUSTMENT_DETAIL"
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.drivers d
          WHERE d.user_id = auth.uid()
            AND d.operator_id = "ADJUSTMENT_DETAIL".operator_id
        )
      );
  END IF;
END
$$;

