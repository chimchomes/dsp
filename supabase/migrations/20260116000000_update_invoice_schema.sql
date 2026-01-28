
-- 1A) WEEKLY_PAY (keep table, enforce defaults)
ALTER TABLE public.WEEKLY_PAY
  ALTER COLUMN invoice_number SET NOT NULL,
  ALTER COLUMN period_start SET NOT NULL,
  ALTER COLUMN period_end SET NOT NULL,
  ALTER COLUMN operator_id SET NOT NULL,
  ALTER COLUMN tour_id SET NOT NULL,
  ALTER COLUMN total_pay SET NOT NULL;

-- 1B) DAILY_PAY_QTY (keep table, enforce defaults)
ALTER TABLE public.DAILY_PAY_QTY
  ALTER COLUMN invoice_number SET NOT NULL,
  ALTER COLUMN operator_id SET NOT NULL,
  ALTER COLUMN tour_id SET NOT NULL,
  ALTER COLUMN regular_delivery_qty SET DEFAULT 0,
  ALTER COLUMN locker_parcel_delivery_qty SET DEFAULT 0,
  ALTER COLUMN adhoc_scheduled_collections_qty SET DEFAULT 0,
  ALTER COLUMN packet_qty SET DEFAULT 0,
  ALTER COLUMN total_qty SET DEFAULT 0;

-- 1C) DAILY_PAY_SUMMARY (keep table)
ALTER TABLE public.DAILY_PAY_SUMMARY
  ALTER COLUMN invoice_number SET NOT NULL,
  ALTER COLUMN operator_id SET NOT NULL,
  ALTER COLUMN tour_id SET NOT NULL;

ALTER TABLE public.DAILY_PAY_SUMMARY
  ADD COLUMN IF NOT EXISTS total_deductions NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_additional_payment NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_adj_minus NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_adj_plus NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_adj_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overall_summary_amount NUMERIC DEFAULT 0;

-- 1D) ADJUSTMENT_DETAIL (REDESIGN to match spec)
DROP TABLE IF EXISTS public.ADJUSTMENT_DETAIL;

CREATE TABLE public.ADJUSTMENT_DETAIL (
  invoice_number TEXT NOT NULL,
  adjustment_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  operator_id TEXT NOT NULL,
  tour_id TEXT NULL,
  adjustment_type TEXT NOT NULL,
  adjustment_reason TEXT,
  adjustment_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (invoice_number, adjustment_date, operator_id, adjustment_type, adjustment_amount)
);


-- 1E) ADJUSTMENT_SUMMARY (REDESIGN to invoice-level summary)
DROP TABLE IF EXISTS public.ADJUSTMENT_SUMMARY;

CREATE TABLE public.ADJUSTMENT_SUMMARY (
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  operator_id TEXT NOT NULL,
  manual_adj_plus NUMERIC DEFAULT 0,
  manual_adj_minus NUMERIC DEFAULT 0,
  manual_adj_total NUMERIC DEFAULT 0,
  overall_summary_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (invoice_number, operator_id)
);

-- 1F) REMOVE OLD TABLE
DROP TABLE IF EXISTS public.daily_pay_legacy;
