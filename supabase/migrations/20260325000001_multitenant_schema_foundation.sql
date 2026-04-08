-- =============================================================================
-- Phase 1: Multi-Tenant Schema Foundation
-- Creates tenants table, adds master_admin role, adds tenant_id to all tables,
-- backfills existing data, creates helper functions, updates views.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1.1 Create the tenants table
-- ---------------------------------------------------------------------------
CREATE TABLE public.tenants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name            TEXT NOT NULL,
    trading_name            TEXT,
    company_number          TEXT,
    vat_registration_number TEXT,
    primary_email           TEXT NOT NULL,
    primary_phone           TEXT,
    website                 TEXT,
    address_line_1          TEXT,
    address_line_2          TEXT,
    address_line_3          TEXT,
    address_line_4          TEXT,
    city                    TEXT,
    county                  TEXT,
    postcode                TEXT,
    country                 TEXT DEFAULT 'United Kingdom',
    logo_url                TEXT,
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','suspended','onboarding','cancelled')),
    subscription_plan       TEXT DEFAULT 'standard',
    max_users               INT DEFAULT 50,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now(),
    created_by              UUID REFERENCES auth.users(id)
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 1.2 master_admin enum value
-- (Added in separate migration 20260325000000_add_master_admin_enum.sql
--  because ALTER TYPE ... ADD VALUE cannot run inside a transaction)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1.3 Seed default tenant from existing company_details
-- ---------------------------------------------------------------------------
INSERT INTO public.tenants (
    id, company_name, address_line_1, address_line_2, address_line_3,
    address_line_4, postcode, company_number, vat_registration_number,
    primary_email
)
SELECT
    gen_random_uuid(),
    COALESCE(company_name, 'Default Company'),
    address_line_1, address_line_2, address_line_3, address_line_4,
    postcode, company_number, vat_registration_number,
    COALESCE(
        (SELECT email FROM staff_profiles LIMIT 1),
        'admin@company.com'
    )
FROM public.company_details
LIMIT 1;

-- Fallback: if company_details was empty, create a placeholder tenant
INSERT INTO public.tenants (id, company_name, primary_email)
SELECT gen_random_uuid(), 'Default Company', 'admin@company.com'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants);

-- ---------------------------------------------------------------------------
-- 1.4 Add tenant_id to ALL data tables
-- Pattern: add nullable -> backfill -> set NOT NULL -> add FK + index
-- ---------------------------------------------------------------------------

-- user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.user_roles SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- staff_profiles
ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.staff_profiles SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- driver_profiles
ALTER TABLE public.driver_profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.driver_profiles SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- routes
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.routes SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- stops
ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.stops SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.invoices SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- "WEEKLY_PAY"
ALTER TABLE public."WEEKLY_PAY" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public."WEEKLY_PAY" SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- "DAILY_PAY_QTY"
ALTER TABLE public."DAILY_PAY_QTY" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public."DAILY_PAY_QTY" SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- "DAILY_PAY_SUMMARY"
ALTER TABLE public."DAILY_PAY_SUMMARY" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public."DAILY_PAY_SUMMARY" SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- "ADJUSTMENT_DETAIL"
ALTER TABLE public."ADJUSTMENT_DETAIL" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public."ADJUSTMENT_DETAIL" SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- "ADJUSTMENT_SUMMARY"
ALTER TABLE public."ADJUSTMENT_SUMMARY" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public."ADJUSTMENT_SUMMARY" SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- payslips
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.payslips SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- earnings
ALTER TABLE public.earnings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.earnings SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- deductions
ALTER TABLE public.deductions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.deductions SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- pay_statements
ALTER TABLE public.pay_statements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.pay_statements SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- supplier_rates
ALTER TABLE public.supplier_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.supplier_rates SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- driver_rates
ALTER TABLE public.driver_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.driver_rates SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- pay_rates
ALTER TABLE public.pay_rates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.pay_rates SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- rate_status
ALTER TABLE public.rate_status ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.rate_status SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- dispatchers
ALTER TABLE public.dispatchers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.dispatchers SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.messages SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.notifications SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- notification_settings
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.notification_settings SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- incidents
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.incidents SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- onboarding_sessions
ALTER TABLE public.onboarding_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.onboarding_sessions SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- driver_documents
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.driver_documents SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- training_items
ALTER TABLE public.training_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.training_items SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- driver_training_progress
ALTER TABLE public.driver_training_progress ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.driver_training_progress SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- activity_logs
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.activity_logs SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- internal_expenses
ALTER TABLE public.internal_expenses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.internal_expenses SET tenant_id = (SELECT id FROM public.tenants LIMIT 1) WHERE tenant_id IS NULL;

-- ---------------------------------------------------------------------------
-- 1.5 Set NOT NULL on tenant_id for all tables (master_admin rows in
--     user_roles may have NULL tenant_id, so that column stays nullable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff_profiles      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.driver_profiles     ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.routes              ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.stops               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.invoices            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public."WEEKLY_PAY"        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public."DAILY_PAY_QTY"     ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public."DAILY_PAY_SUMMARY" ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public."ADJUSTMENT_DETAIL" ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public."ADJUSTMENT_SUMMARY" ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.payslips            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.earnings            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.deductions          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pay_statements      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.supplier_rates      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.driver_rates        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pay_rates           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.rate_status         ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.dispatchers         ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.messages            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.notifications       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.notification_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.incidents           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.onboarding_sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.driver_documents    ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.training_items      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.driver_training_progress ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.activity_logs       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.internal_expenses   ALTER COLUMN tenant_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 1.6 Create indexes for tenant_id on all tables
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant       ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_tenant    ON public.staff_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_tenant   ON public.driver_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_routes_tenant            ON public.routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stops_tenant             ON public.stops(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant          ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_weekly_pay_tenant        ON public."WEEKLY_PAY"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_pay_qty_tenant     ON public."DAILY_PAY_QTY"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_pay_summary_tenant ON public."DAILY_PAY_SUMMARY"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_adj_detail_tenant        ON public."ADJUSTMENT_DETAIL"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_adj_summary_tenant       ON public."ADJUSTMENT_SUMMARY"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payslips_tenant          ON public.payslips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_earnings_tenant          ON public.earnings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deductions_tenant        ON public.deductions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pay_statements_tenant    ON public.pay_statements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_rates_tenant    ON public.supplier_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_rates_tenant      ON public.driver_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pay_rates_tenant         ON public.pay_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_status_tenant       ON public.rate_status(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatchers_tenant       ON public.dispatchers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant          ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant     ON public.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notif_settings_tenant    ON public.notification_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant         ON public.incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tenant        ON public.onboarding_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_tenant  ON public.driver_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_items_tenant    ON public.training_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_driver_training_tenant   ON public.driver_training_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant     ON public.activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_internal_expenses_tenant ON public.internal_expenses(tenant_id);

-- ---------------------------------------------------------------------------
-- 1.7 Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = auth.uid()
  AND tenant_id IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'master_admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 1.8 Update views to include tenant_id
-- (Must DROP first because CREATE OR REPLACE VIEW cannot reorder/rename columns)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.role_profiles;
CREATE VIEW public.role_profiles AS
SELECT ur.role,
    ur.tenant_id,
    sp.user_id,
    COALESCE(sp.full_name, TRIM(BOTH FROM concat_ws(' '::text, sp.first_name, sp.surname))) AS full_name,
    sp.first_name,
    sp.surname,
    sp.email,
    sp.address_line_1,
    sp.address_line_2,
    sp.address_line_3,
    sp.postcode,
    sp.contact_phone,
    sp.emergency_contact_name,
    sp.emergency_contact_phone,
    NULL::text AS license_number,
    NULL::date AS license_expiry,
    NULL::text AS operator_id,
    NULL::text AS national_insurance,
    NULL::boolean AS active
   FROM user_roles ur
   JOIN staff_profiles sp ON sp.user_id = ur.user_id
  WHERE ur.role = ANY (ARRAY['admin'::app_role, 'hr'::app_role, 'finance'::app_role])
UNION ALL
SELECT ur.role,
    ur.tenant_id,
    dp.user_id,
    COALESCE(dp.name, TRIM(BOTH FROM concat_ws(' '::text, dp.first_name, dp.surname))) AS full_name,
    dp.first_name,
    dp.surname,
    dp.email,
    dp.address_line_1,
    dp.address_line_2,
    dp.address_line_3,
    dp.postcode,
    dp.contact_phone,
    dp.emergency_contact_name,
    dp.emergency_contact_phone,
    dp.license_number,
    dp.license_expiry,
    dp.operator_id,
    dp.national_insurance,
    dp.active
   FROM user_roles ur
   JOIN driver_profiles dp ON dp.user_id = ur.user_id
  WHERE ur.role = 'driver'::app_role;

-- roles_list now includes master_admin
DROP VIEW IF EXISTS public.roles_list;
CREATE VIEW public.roles_list AS
SELECT (unnest(enum_range(NULL::app_role)))::text AS role;

-- ---------------------------------------------------------------------------
-- 1.9 Create backward-compat view for company_details
-- ---------------------------------------------------------------------------
-- The existing company_details table stays for now; new code should use tenants.

COMMIT;
