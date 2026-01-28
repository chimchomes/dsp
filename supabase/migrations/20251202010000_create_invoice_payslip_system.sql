-- Add operator_id to drivers table
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS operator_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS drivers_operator_id_idx ON public.drivers(operator_id);

-- Create supplier_rates table
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

CREATE INDEX idx_supplier_rates_provider ON public.supplier_rates(provider);
CREATE INDEX idx_supplier_rates_rate_id ON public.supplier_rates(rate_id);

-- Create driver_rates table (links operator to rate_id and rate)
CREATE TABLE IF NOT EXISTS public.driver_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id TEXT NOT NULL,
  rate_id TEXT NOT NULL,
  rate DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(operator_id, rate_id)
);

CREATE INDEX idx_driver_rates_operator ON public.driver_rates(operator_id);
CREATE INDEX idx_driver_rates_rate_id ON public.driver_rates(rate_id);

-- Create invoices table
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

CREATE INDEX idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX idx_invoices_period ON public.invoices(period_start, period_end);
CREATE INDEX idx_invoices_date ON public.invoices(invoice_date);

-- Create weekly_pay table (from invoice data)
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

CREATE INDEX idx_weekly_pay_invoice ON public.weekly_pay(invoice_number);
CREATE INDEX idx_weekly_pay_operator ON public.weekly_pay(operator_id);
CREATE INDEX idx_weekly_pay_period ON public.weekly_pay(period_start, period_end);

-- Create daily_pay table (from invoice data)
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

CREATE INDEX idx_daily_pay_invoice ON public.daily_pay(invoice_number);
CREATE INDEX idx_daily_pay_operator ON public.daily_pay(operator_id);
CREATE INDEX idx_daily_pay_date ON public.daily_pay(working_day);

-- Create payslips table
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

CREATE INDEX idx_payslips_driver ON public.payslips(driver_id);
CREATE INDEX idx_payslips_invoice ON public.payslips(invoice_number);
CREATE INDEX idx_payslips_period ON public.payslips(period_start, period_end);

-- Enable RLS
ALTER TABLE public.supplier_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_pay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_pay ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_rates (admin and finance only)
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

-- RLS Policies for driver_rates (admin and finance only)
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

-- RLS Policies for invoices (admin and finance can manage, drivers can view their own)
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

-- RLS Policies for weekly_pay (admin and finance can manage, drivers can view their own)
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

-- RLS Policies for daily_pay (admin and finance can manage, drivers can view their own)
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

-- RLS Policies for payslips (admin and finance can manage, drivers can view their own)
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

CREATE POLICY "Drivers can view their own payslips"
  ON public.payslips
  FOR SELECT
  USING (driver_id IN (
    SELECT id FROM public.drivers WHERE user_id = auth.uid()
  ));

-- Comments
COMMENT ON TABLE public.supplier_rates IS 'Supplier rates for different providers and statuses';
COMMENT ON TABLE public.driver_rates IS 'Driver rates linking operators to rate IDs';
COMMENT ON TABLE public.invoices IS 'Uploaded invoices from providers';
COMMENT ON TABLE public.weekly_pay IS 'Weekly pay breakdown from invoices';
COMMENT ON TABLE public.daily_pay IS 'Daily pay breakdown from invoices';
COMMENT ON TABLE public.payslips IS 'Generated payslips for drivers';
COMMENT ON COLUMN public.drivers.operator_id IS 'Operator ID (e.g., DB6249) linked to invoices';
