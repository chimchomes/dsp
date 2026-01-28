-- Create pay_rates table
CREATE TABLE IF NOT EXISTS public.pay_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OWN VEHICLE', 'LEASED')),
  rate DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX idx_pay_rates_provider ON public.pay_rates(provider);
CREATE INDEX idx_pay_rates_status ON public.pay_rates(status);
CREATE INDEX idx_pay_rates_rate_id ON public.pay_rates(rate_id);

-- Enable RLS
ALTER TABLE public.pay_rates ENABLE ROW LEVEL SECURITY;

-- Admins and Finance can view all pay rates
CREATE POLICY "Admins and Finance can view pay rates"
  ON public.pay_rates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

-- Admins and Finance can insert pay rates
CREATE POLICY "Admins and Finance can insert pay rates"
  ON public.pay_rates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

-- Admins and Finance can update pay rates
CREATE POLICY "Admins and Finance can update pay rates"
  ON public.pay_rates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

-- Admins and Finance can delete pay rates
CREATE POLICY "Admins and Finance can delete pay rates"
  ON public.pay_rates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

-- Add comments
COMMENT ON TABLE public.pay_rates IS 'Pay rates per provider and vehicle status';
COMMENT ON COLUMN public.pay_rates.rate_id IS 'Unique identifier for the rate (e.g., AMZ001)';
COMMENT ON COLUMN public.pay_rates.provider IS 'Provider name (e.g., YODEL)';
COMMENT ON COLUMN public.pay_rates.status IS 'Vehicle status: OWN VEHICLE or LEASED';
COMMENT ON COLUMN public.pay_rates.rate IS 'Rate amount in decimal format';

-- Insert example data
INSERT INTO public.pay_rates (rate_id, provider, status, rate) VALUES
  ('AMZ001', 'YODEL', 'OWN VEHICLE', 2.50),
  ('AMZ002', 'YODEL', 'LEASED', 1.90)
ON CONFLICT (rate_id) DO NOTHING;
