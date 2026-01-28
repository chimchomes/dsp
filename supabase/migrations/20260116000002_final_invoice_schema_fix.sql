-- Drop any accidentally-created quoted uppercase tables if they exist
DROP TABLE IF EXISTS public."WEEKLY_PAY" CASCADE;
DROP TABLE IF EXISTS public."DAILY_PAY_QTY" CASCADE;
DROP TABLE IF EXISTS public."DAILY_PAY_SUMMARY" CASCADE;
DROP TABLE IF EXISTS public."ADJUSTMENT_DETAIL" CASCADE;
DROP TABLE IF EXISTS public."ADJUSTMENT_SUMMARY" CASCADE;

-- Deprecate the old public.weekly_pay table by renaming it
ALTER TABLE IF EXISTS public.weekly_pay RENAME TO weekly_pay_legacy;

-- Create the new weekly_pay table
CREATE TABLE public.weekly_pay (
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    operator_id TEXT NOT NULL,
    tour TEXT NOT NULL,
    delivered_qty INTEGER DEFAULT 0,
    collected_qty INTEGER DEFAULT 0,
    sacks_qty INTEGER DEFAULT 0,
    packets_qty INTEGER DEFAULT 0,
    total_qty INTEGER DEFAULT 0,
    yodel_weekly_amount NUMERIC DEFAULT 0,
    PRIMARY KEY (invoice_number, operator_id, tour)
);

-- Create the new daily_pay_qty table
CREATE TABLE public.daily_pay_qty (
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    working_day DATE NOT NULL,
    operator_id TEXT NOT NULL,
    tour TEXT NOT NULL,
    adhoc_scheduled_collections_qty INTEGER DEFAULT 0,
    packet_qty INTEGER DEFAULT 0,
    regular_delivery_qty INTEGER DEFAULT 0,
    locker_parcel_delivery_qty INTEGER DEFAULT 0,
    yodel_store_collection_qty INTEGER DEFAULT 0,
    yodel_store_delivery_qty INTEGER DEFAULT 0,
    total_qty INTEGER DEFAULT 0,
    PRIMARY KEY (invoice_number, working_day, operator_id, tour)
);

-- Create the new daily_pay_summary table
CREATE TABLE public.daily_pay_summary (
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    working_day DATE NOT NULL,
    operator_id TEXT NOT NULL,
    tour TEXT NOT NULL,
    service_group TEXT NOT NULL,
    qty_paid INTEGER DEFAULT 0,
    qty_unpaid INTEGER DEFAULT 0,
    qty_total INTEGER DEFAULT 0,
    amount_total NUMERIC DEFAULT 0,
    PRIMARY KEY (invoice_number, working_day, operator_id, tour, service_group)
);

-- Create the new adjustment_detail table
CREATE TABLE public.adjustment_detail (
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

-- Add unique index for idempotency on adjustment_detail
CREATE UNIQUE INDEX adjustment_detail_idempotency_idx ON public.adjustment_detail (
    invoice_number,
    adjustment_date,
    coalesce(operator_id,''),
    coalesce(tour,''),
    coalesce(parcel_id,''),
    adjustment_type,
    adjustment_amount
);

-- Create the new adjustment_summary table
CREATE TABLE public.adjustment_summary (
    invoice_number TEXT PRIMARY KEY,
    invoice_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    pre_adj_total NUMERIC DEFAULT 0,
    manual_adj_minus NUMERIC DEFAULT 0,
    manual_adj_plus NUMERIC DEFAULT 0,
    post_adj_total NUMERIC DEFAULT 0
);