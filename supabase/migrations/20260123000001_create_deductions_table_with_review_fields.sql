CREATE TABLE IF NOT EXISTS public.deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  deduction_type TEXT NOT NULL CHECK (deduction_type IN ('fuel', 'damage', 'lateness', 'manual')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone,
  rejection_reason text
);

-- Add RLS policies if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Dispatchers can view all deductions') THEN
    CREATE POLICY "Dispatchers can view all deductions"
    ON public.deductions FOR SELECT
    USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Dispatchers can manage deductions') THEN
    CREATE POLICY "Dispatchers can manage deductions"
    ON public.deductions FOR ALL
    USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Drivers can view their own deductions') THEN
    CREATE POLICY "Drivers can view their own deductions"
    ON public.deductions FOR SELECT
    USING (driver_id IN (
      SELECT id FROM public.drivers WHERE email = (auth.jwt() ->> 'email')
    ));
  END IF;
END $$;

-- Add foreign key constraint for reviewed_by if it's not already defined
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deductions_reviewed_by_fkey'
  ) THEN
    ALTER TABLE public.deductions
    ADD CONSTRAINT deductions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- Add table to realtime publication if not already added
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'deductions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deductions;
  END IF;
END $$;