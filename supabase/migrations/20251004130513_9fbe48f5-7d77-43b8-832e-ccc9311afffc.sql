-- Create earnings table to track driver weekly earnings
CREATE TABLE public.earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  gross_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  route_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

-- Create deductions table to track all deductions
CREATE TABLE public.deductions (
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

ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;

-- Create pay_statements table for final payout records
CREATE TABLE public.pay_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_earnings NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_payout NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pay_statements ENABLE ROW LEVEL SECURITY;

-- RLS policies for earnings
CREATE POLICY "Dispatchers can view all earnings"
ON public.earnings FOR SELECT
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Dispatchers can manage earnings"
ON public.earnings FOR ALL
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view their own earnings"
ON public.earnings FOR SELECT
USING (driver_id IN (
  SELECT id FROM public.drivers WHERE email = (auth.jwt() ->> 'email')
));

-- RLS policies for deductions
CREATE POLICY "Dispatchers can view all deductions"
ON public.deductions FOR SELECT
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Dispatchers can manage deductions"
ON public.deductions FOR ALL
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view their own deductions"
ON public.deductions FOR SELECT
USING (driver_id IN (
  SELECT id FROM public.drivers WHERE email = (auth.jwt() ->> 'email')
));

-- RLS policies for pay_statements
CREATE POLICY "Dispatchers can view all pay statements"
ON public.pay_statements FOR SELECT
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Dispatchers can manage pay statements"
ON public.pay_statements FOR ALL
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view their own pay statements"
ON public.pay_statements FOR SELECT
USING (driver_id IN (
  SELECT id FROM public.drivers WHERE email = (auth.jwt() ->> 'email')
));

-- Trigger for updating updated_at on earnings
CREATE TRIGGER update_earnings_updated_at
BEFORE UPDATE ON public.earnings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating updated_at on pay_statements
CREATE TRIGGER update_pay_statements_updated_at
BEFORE UPDATE ON public.pay_statements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.earnings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deductions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pay_statements;