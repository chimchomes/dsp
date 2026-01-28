-- Drop any accidentally-created quoted uppercase tables if they exist
DROP TABLE IF EXISTS public."WEEKLY_PAY" CASCADE;
DROP TABLE IF EXISTS public."DAILY_PAY_QTY" CASCADE;
DROP TABLE IF EXISTS public."DAILY_PAY_SUMMARY" CASCADE;
DROP TABLE IF EXISTS public."ADJUSTMENT_DETAIL" CASCADE;
DROP TABLE IF EXISTS public."ADJUSTMENT_SUMMARY" CASCADE;

-- Drop weekly_pay_legacy if it already exists from a previous partial migration
DROP TABLE IF EXISTS public.weekly_pay_legacy CASCADE;

-- Drop the new tables if they already exist from a previous partial migration, now ensuring uppercase ones are handled too.
-- This order is crucial to prevent foreign key issues during recreation.
DROP TABLE IF EXISTS public."ADJUSTMENT_DETAIL" CASCADE;
DROP TABLE IF EXISTS public."ADJUSTMENT_SUMMARY" CASCADE;
DROP TABLE IF EXISTS public."DAILY_PAY_SUMMARY" CASCADE;
DROP TABLE IF EXISTS public."DAILY_PAY_QTY" CASCADE;
DROP TABLE IF EXISTS public."WEEKLY_PAY" CASCADE;


-- Deprecate the old public.weekly_pay table by renaming it to avoid confusion
ALTER TABLE IF EXISTS public.weekly_pay RENAME TO weekly_pay_legacy;

-- Create the new WEEKLY_PAY table (UPPERCASE as per new prompt)
CREATE TABLE public."WEEKLY_PAY" (
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    operator_id TEXT NOT NULL,
    tour TEXT NOT NULL,
    delivered_qty INTEGER DEFAULT 0 NOT NULL,
    collected_qty INTEGER DEFAULT 0 NOT NULL,
    sacks_qty INTEGER DEFAULT 0 NOT NULL,
    packets_qty INTEGER DEFAULT 0 NOT NULL,
    total_qty INTEGER DEFAULT 0 NOT NULL,
    yodel_weekly_amount NUMERIC DEFAULT 0 NOT NULL,
    PRIMARY KEY (invoice_number, operator_id, tour)
);

-- Create the new DAILY_PAY_QTY table (UPPERCASE as per new prompt)
CREATE TABLE public."DAILY_PAY_QTY" (
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    working_day DATE NOT NULL,
    operator_id TEXT NOT NULL,
    tour TEXT NOT NULL,
    adhoc_scheduled_collections_qty INTEGER DEFAULT 0 NOT NULL,
    packet_qty INTEGER DEFAULT 0 NOT NULL,
    regular_delivery_qty INTEGER DEFAULT 0 NOT NULL,
    locker_parcel_delivery_qty INTEGER DEFAULT 0 NOT NULL,
    yodel_store_collection_qty INTEGER DEFAULT 0 NOT NULL,
    yodel_store_delivery_qty INTEGER DEFAULT 0 NOT NULL,
    total_qty INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (invoice_number, working_day, operator_id, tour)
);

-- Create the new DAILY_PAY_SUMMARY table (UPPERCASE as per new prompt)
CREATE TABLE public."DAILY_PAY_SUMMARY" (
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    working_day DATE NOT NULL,
    operator_id TEXT NOT NULL,
    tour TEXT NOT NULL,
    service_group TEXT NOT NULL,
    qty_paid INTEGER DEFAULT 0 NOT NULL,
    qty_unpaid INTEGER DEFAULT 0 NOT NULL,
    qty_total INTEGER DEFAULT 0 NOT NULL,
    amount_total NUMERIC DEFAULT 0 NOT NULL,
    PRIMARY KEY (invoice_number, working_day, operator_id, tour, service_group)
);

-- Create the new ADJUSTMENT_DETAIL table (UPPERCASE as per new prompt)
CREATE TABLE public."ADJUSTMENT_DETAIL" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    adjustment_date DATE NOT NULL,
    operator_id TEXT NULL,
    tour TEXT NULL,
    parcel_id TEXT NULL,
    adjustment_type TEXT NOT NULL,
    adjustment_amount NUMERIC NOT NULL
);

-- Add unique index for idempotency on ADJUSTMENT_DETAIL
CREATE UNIQUE INDEX "adjustment_detail_idempotency_idx" ON public."ADJUSTMENT_DETAIL" (
    invoice_number,
    adjustment_date,
    coalesce(operator_id,''),
    coalesce(tour,''),
    coalesce(parcel_id,''),
    adjustment_type,
    adjustment_amount
);

-- Create the new ADJUSTMENT_SUMMARY table (UPPERCASE as per new prompt)
CREATE TABLE public."ADJUSTMENT_SUMMARY" (
    invoice_number TEXT PRIMARY KEY,
    invoice_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    pre_adj_total NUMERIC DEFAULT 0 NOT NULL,
    manual_adj_minus NUMERIC DEFAULT 0 NOT NULL,
    manual_adj_plus NUMERIC DEFAULT 0 NOT NULL,
    post_adj_total NUMERIC DEFAULT 0 NOT NULL
);

-- RLS Policies for UPPERCASE tables (admin/finance roles for INSERT/UPDATE/DELETE)
-- Policies should include both USING and WITH CHECK to enable write access

-- WEEKLY_PAY RLS
ALTER TABLE public."WEEKLY_PAY" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for finance and admin on WEEKLY_PAY" ON public."WEEKLY_PAY";
CREATE POLICY "Enable all for finance and admin on WEEKLY_PAY"
    ON public."WEEKLY_PAY"
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')));

-- DAILY_PAY_QTY RLS
ALTER TABLE public."DAILY_PAY_QTY" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for finance and admin on DAILY_PAY_QTY" ON public."DAILY_PAY_QTY";
CREATE POLICY "Enable all for finance and admin on DAILY_PAY_QTY"
    ON public."DAILY_PAY_QTY"
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')));

-- DAILY_PAY_SUMMARY RLS
ALTER TABLE public."DAILY_PAY_SUMMARY" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for finance and admin on DAILY_PAY_SUMMARY" ON public."DAILY_PAY_SUMMARY";
CREATE POLICY "Enable all for finance and admin on DAILY_PAY_SUMMARY"
    ON public."DAILY_PAY_SUMMARY"
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')));

-- ADJUSTMENT_DETAIL RLS
ALTER TABLE public."ADJUSTMENT_DETAIL" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for finance and admin on ADJUSTMENT_DETAIL" ON public."ADJUSTMENT_DETAIL";
CREATE POLICY "Enable all for finance and admin on ADJUSTMENT_DETAIL"
    ON public."ADJUSTMENT_DETAIL"
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')));

-- ADJUSTMENT_SUMMARY RLS
ALTER TABLE public."ADJUSTMENT_SUMMARY" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for finance and admin on ADJUSTMENT_SUMMARY" ON public."ADJUSTMENT_SUMMARY";
CREATE POLICY "Enable all for finance and admin on ADJUSTMENT_SUMMARY"
    ON public."ADJUSTMENT_SUMMARY"
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'finance')));

-- Add foreign key constraints to invoices table for newly created tables if not already present.
-- Ensure the 'invoices' table exists first, it's assumed to be pre-existing.

-- Add FK from WEEKLY_PAY to invoices
ALTER TABLE public."WEEKLY_PAY"
DROP CONSTRAINT IF EXISTS "WEEKLY_PAY_invoice_number_fkey",
ADD CONSTRAINT "WEEKLY_PAY_invoice_number_fkey"
  FOREIGN KEY (invoice_number) REFERENCES public.invoices(invoice_number) ON DELETE CASCADE;

-- Add FK from DAILY_PAY_QTY to invoices
ALTER TABLE public."DAILY_PAY_QTY"
DROP CONSTRAINT IF EXISTS "DAILY_PAY_QTY_invoice_number_fkey",
ADD CONSTRAINT "DAILY_PAY_QTY_invoice_number_fkey"
  FOREIGN KEY (invoice_number) REFERENCES public.invoices(invoice_number) ON DELETE CASCADE;

-- Add FK from DAILY_PAY_SUMMARY to invoices
ALTER TABLE public."DAILY_PAY_SUMMARY"
DROP CONSTRAINT IF EXISTS "DAILY_PAY_SUMMARY_invoice_number_fkey",
ADD CONSTRAINT "DAILY_PAY_SUMMARY_invoice_number_fkey"
  FOREIGN KEY (invoice_number) REFERENCES public.invoices(invoice_number) ON DELETE CASCADE;

-- Add FK from ADJUSTMENT_DETAIL to invoices
ALTER TABLE public."ADJUSTMENT_DETAIL"
DROP CONSTRAINT IF EXISTS "ADJUSTMENT_DETAIL_invoice_number_fkey",
ADD CONSTRAINT "ADJUSTMENT_DETAIL_invoice_number_fkey"
  FOREIGN KEY (invoice_number) REFERENCES public.invoices(invoice_number) ON DELETE CASCADE;

-- Add FK from ADJUSTMENT_SUMMARY to invoices
ALTER TABLE public."ADJUSTMENT_SUMMARY"
DROP CONSTRAINT IF EXISTS "ADJUSTMENT_SUMMARY_invoice_number_fkey",
ADD CONSTRAINT "ADJUSTMENT_SUMMARY_invoice_number_fkey"
  FOREIGN KEY (invoice_number) REFERENCES public.invoices(invoice_number) ON DELETE CASCADE;
