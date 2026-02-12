-- ============================================================================
-- VAT & Expenses Schema
-- Creates company_details and internal_expenses tables for VAT tracking
-- ============================================================================

-- 1. Company Details table (single row for company info on reports)
CREATE TABLE IF NOT EXISTS public.company_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  address_line_1 TEXT NOT NULL DEFAULT '',
  address_line_2 TEXT NOT NULL DEFAULT '',
  address_line_3 TEXT NOT NULL DEFAULT '',
  address_line_4 TEXT NOT NULL DEFAULT '',
  postcode TEXT NOT NULL DEFAULT '',
  company_number TEXT NOT NULL DEFAULT '',
  vat_registration_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Internal Expenses table
CREATE TABLE IF NOT EXISTS public.internal_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  reclaimable_vat BOOLEAN NOT NULL DEFAULT false,
  vat_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'Submitted',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_expenses_date ON public.internal_expenses(date);
CREATE INDEX IF NOT EXISTS idx_internal_expenses_status ON public.internal_expenses(status);
CREATE INDEX IF NOT EXISTS idx_internal_expenses_reclaimable ON public.internal_expenses(reclaimable_vat);

-- 3. Enable RLS
ALTER TABLE public.company_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_expenses ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for company_details
CREATE POLICY "Authenticated users can read company details"
  ON public.company_details
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and Finance can manage company details"
  ON public.company_details
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'finance')
    )
  );

-- 5. RLS Policies for internal_expenses
CREATE POLICY "Admins and Finance can manage internal expenses"
  ON public.internal_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'finance')
    )
  );

-- 6. Comments
COMMENT ON TABLE public.company_details IS 'Company details for PDF reports and VAT returns';
COMMENT ON TABLE public.internal_expenses IS 'Internal business expenses for VAT tracking and reclaim';
