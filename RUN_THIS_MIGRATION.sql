-- ============================================
-- COMBINED MIGRATION: Pay Rates + Invoice/Payslip System
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Create pay_rates table
-- ============================================
CREATE TABLE IF NOT EXISTS public.pay_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OWN VEHICLE', 'LEASED')),
  rate DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_rates_provider ON public.pay_rates(provider);
CREATE INDEX IF NOT EXISTS idx_pay_rates_status ON public.pay_rates(status);
CREATE INDEX IF NOT EXISTS idx_pay_rates_rate_id ON public.pay_rates(rate_id);

ALTER TABLE public.pay_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Finance can view pay rates" ON public.pay_rates;
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

DROP POLICY IF EXISTS "Admins and Finance can insert pay rates" ON public.pay_rates;
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

DROP POLICY IF EXISTS "Admins and Finance can update pay rates" ON public.pay_rates;
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

DROP POLICY IF EXISTS "Admins and Finance can delete pay rates" ON public.pay_rates;
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

COMMENT ON TABLE public.pay_rates IS 'Pay rates per provider and vehicle status';
COMMENT ON COLUMN public.pay_rates.rate_id IS 'Unique identifier for the rate (e.g., AMZ001)';
COMMENT ON COLUMN public.pay_rates.provider IS 'Provider name (e.g., YODEL)';
COMMENT ON COLUMN public.pay_rates.status IS 'Vehicle status: OWN VEHICLE or LEASED';
COMMENT ON COLUMN public.pay_rates.rate IS 'Rate amount in decimal format';

INSERT INTO public.pay_rates (rate_id, provider, status, rate) VALUES
  ('AMZ001', 'YODEL', 'OWN VEHICLE', 2.50),
  ('AMZ002', 'YODEL', 'LEASED', 1.90)
ON CONFLICT (rate_id) DO NOTHING;

-- ============================================
-- PART 2: Add operator_id to drivers table
-- ============================================
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS operator_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS drivers_operator_id_idx ON public.drivers(operator_id);

-- ============================================
-- PART 3: Create supplier_rates table
-- ============================================
CREATE TABLE IF NOT EXISTS public.supplier_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  status TEXT NOT NULL,
  rate DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_rates_provider ON public.supplier_rates(provider);
CREATE INDEX IF NOT EXISTS idx_supplier_rates_rate_id ON public.supplier_rates(rate_id);

-- ============================================
-- PART 4: Create driver_rates table
-- ============================================
CREATE TABLE IF NOT EXISTS public.driver_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id TEXT NOT NULL,
  rate_id TEXT NOT NULL,
  rate DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(operator_id, rate_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_rates_operator ON public.driver_rates(operator_id);
CREATE INDEX IF NOT EXISTS idx_driver_rates_rate_id ON public.driver_rates(rate_id);

-- ============================================
-- PART 5: Create invoices table
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  supplier_id TEXT,
  provider TEXT,
  pdf_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  net_total DECIMAL(10, 2),
  vat DECIMAL(10, 2),
  gross_total DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);

-- ============================================
-- PART 6: Create weekly_pay table
-- ============================================
CREATE TABLE IF NOT EXISTS public.weekly_pay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL REFERENCES public.invoices(invoice_number) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  operator_id TEXT NOT NULL,
  tour TEXT,
  delivered INTEGER DEFAULT 0,
  collected INTEGER DEFAULT 0,
  sacks INTEGER DEFAULT 0,
  packets INTEGER DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_pay_invoice ON public.weekly_pay(invoice_number);
CREATE INDEX IF NOT EXISTS idx_weekly_pay_operator ON public.weekly_pay(operator_id);
CREATE INDEX IF NOT EXISTS idx_weekly_pay_period ON public.weekly_pay(period_start, period_end);

-- ============================================
-- PART 7: Create daily_pay table
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_pay (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL REFERENCES public.invoices(invoice_number) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  working_day DATE NOT NULL,
  operator_id TEXT NOT NULL,
  tour TEXT,
  service_group TEXT NOT NULL,
  qty INTEGER DEFAULT 0,
  rate DECIMAL(10, 2),
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_pay_invoice ON public.daily_pay(invoice_number);
CREATE INDEX IF NOT EXISTS idx_daily_pay_operator ON public.daily_pay(operator_id);
CREATE INDEX IF NOT EXISTS idx_daily_pay_date ON public.daily_pay(working_day);

-- ============================================
-- PART 8: Create payslips table
-- ============================================
CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL REFERENCES public.invoices(invoice_number) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  operator_id TEXT NOT NULL,
  gross_pay DECIMAL(10, 2) NOT NULL DEFAULT 0,
  deductions DECIMAL(10, 2) NOT NULL DEFAULT 0,
  net_pay DECIMAL(10, 2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  generated_by UUID REFERENCES auth.users(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(driver_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_payslips_driver ON public.payslips(driver_id);
CREATE INDEX IF NOT EXISTS idx_payslips_invoice ON public.payslips(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payslips_period ON public.payslips(period_start, period_end);

-- ============================================
-- PART 9: Enable RLS on all tables
-- ============================================
ALTER TABLE public.supplier_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_pay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_pay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 10: RLS Policies for supplier_rates
-- ============================================
DROP POLICY IF EXISTS "Admins and Finance can manage supplier rates" ON public.supplier_rates;
CREATE POLICY "Admins and Finance can manage supplier rates"
  ON public.supplier_rates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

-- ============================================
-- PART 11: RLS Policies for driver_rates
-- ============================================
DROP POLICY IF EXISTS "Admins and Finance can manage driver rates" ON public.driver_rates;
CREATE POLICY "Admins and Finance can manage driver rates"
  ON public.driver_rates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

-- ============================================
-- PART 12: RLS Policies for invoices
-- ============================================
DROP POLICY IF EXISTS "Admins and Finance can manage invoices" ON public.invoices;
CREATE POLICY "Admins and Finance can manage invoices"
  ON public.invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

DROP POLICY IF EXISTS "Drivers can view their own invoices" ON public.invoices;
CREATE POLICY "Drivers can view their own invoices"
  ON public.invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.weekly_pay wp
        WHERE wp.invoice_number = invoices.invoice_number
        AND wp.operator_id = d.operator_id
      )
    )
  );

-- ============================================
-- PART 13: RLS Policies for weekly_pay
-- ============================================
DROP POLICY IF EXISTS "Admins and Finance can manage weekly pay" ON public.weekly_pay;
CREATE POLICY "Admins and Finance can manage weekly pay"
  ON public.weekly_pay
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

DROP POLICY IF EXISTS "Drivers can view their own weekly pay" ON public.weekly_pay;
CREATE POLICY "Drivers can view their own weekly pay"
  ON public.weekly_pay
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = auth.uid()
      AND d.operator_id = weekly_pay.operator_id
    )
  );

-- ============================================
-- PART 14: RLS Policies for daily_pay
-- ============================================
DROP POLICY IF EXISTS "Admins and Finance can manage daily pay" ON public.daily_pay;
CREATE POLICY "Admins and Finance can manage daily pay"
  ON public.daily_pay
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

DROP POLICY IF EXISTS "Drivers can view their own daily pay" ON public.daily_pay;
CREATE POLICY "Drivers can view their own daily pay"
  ON public.daily_pay
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = auth.uid()
      AND d.operator_id = daily_pay.operator_id
    )
  );

-- ============================================
-- PART 15: RLS Policies for payslips
-- ============================================
DROP POLICY IF EXISTS "Admins and Finance can manage payslips" ON public.payslips;
CREATE POLICY "Admins and Finance can manage payslips"
  ON public.payslips
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'finance')
    )
  );

DROP POLICY IF EXISTS "Drivers can view their own payslips" ON public.payslips;
CREATE POLICY "Drivers can view their own payslips"
  ON public.payslips
  FOR SELECT
  USING (driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  ));

-- ============================================
-- PART 16: Add table comments
-- ============================================
COMMENT ON TABLE public.supplier_rates IS 'Supplier rates for different providers and statuses';
COMMENT ON TABLE public.driver_rates IS 'Driver rates linking operators to rate IDs';
COMMENT ON TABLE public.invoices IS 'Uploaded invoices from providers';
COMMENT ON TABLE public.weekly_pay IS 'Weekly pay breakdown from invoices';
COMMENT ON TABLE public.daily_pay IS 'Daily pay breakdown from invoices';
COMMENT ON TABLE public.payslips IS 'Generated payslips for drivers';
COMMENT ON COLUMN public.drivers.operator_id IS 'Operator ID (e.g., DB6249) linked to invoices';
