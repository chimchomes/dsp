-- =============================================================================
-- Fix: RLS infinite recursion on user_roles
--
-- Problem: Policies on user_roles contained EXISTS subqueries against
-- user_roles itself, and policies on other tables also queried user_roles,
-- triggering the same recursive policy evaluation.
--
-- Solution: All role checks now go through SECURITY DEFINER helper functions
-- that bypass RLS entirely. No policy anywhere directly queries user_roles.
-- =============================================================================

BEGIN;

-- ===================================================================
-- 1. CREATE SECURITY DEFINER HELPER FUNCTIONS
-- (DROP first in case parameter names changed)
-- ===================================================================

DROP FUNCTION IF EXISTS public.has_role_in_tenant(app_role[], uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_any_role(app_role[]) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.has_role_in_tenant(required_roles app_role[], tid uuid)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = ANY(required_roles)
      AND tenant_id = tid
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(required_roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = ANY(required_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(uid uuid, role_name text)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid
      AND role::text = role_name
  );
$$;

-- ===================================================================
-- 2. DROP EVERY POLICY (old names + new names) ON EVERY TABLE
-- ===================================================================

-- user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "hr_admin_view_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_delete" ON public.user_roles;

-- tenants
DROP POLICY IF EXISTS "master_admin_all_tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenant_admin_read_own" ON public.tenants;
DROP POLICY IF EXISTS "tenant_admin_update_own" ON public.tenants;

-- staff_profiles
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_read_own_profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_update_own_profile" ON public.staff_profiles;
DROP POLICY IF EXISTS "admin_read_all_staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "admin_update_all_staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "admin_insert_staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "hr_read_all_staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "hr_update_all_staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "hr_insert_staff_profiles" ON public.staff_profiles;
DROP POLICY IF EXISTS "driver_read_staff_for_messaging" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_self_read" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_self_update" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_admin_read" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_admin_insert" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_admin_update" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_hr_read" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_hr_insert" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_hr_update" ON public.staff_profiles;
DROP POLICY IF EXISTS "staff_driver_read_for_messaging" ON public.staff_profiles;

-- driver_profiles
DROP POLICY IF EXISTS "driver_read_own_profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "driver_update_own_profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "admin_read_all_driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "admin_update_all_driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "admin_insert_driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "hr_read_all_driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "hr_update_all_driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "finance_read_driver_profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "dp_self_read" ON public.driver_profiles;
DROP POLICY IF EXISTS "dp_self_update" ON public.driver_profiles;
DROP POLICY IF EXISTS "dp_admin_read" ON public.driver_profiles;
DROP POLICY IF EXISTS "dp_admin_update" ON public.driver_profiles;
DROP POLICY IF EXISTS "dp_admin_insert" ON public.driver_profiles;
DROP POLICY IF EXISTS "dp_hr_read" ON public.driver_profiles;
DROP POLICY IF EXISTS "dp_hr_update" ON public.driver_profiles;
DROP POLICY IF EXISTS "dp_finance_read" ON public.driver_profiles;

-- routes
DROP POLICY IF EXISTS "Drivers can view their own routes" ON public.routes;
DROP POLICY IF EXISTS "Drivers can update their own routes" ON public.routes;
DROP POLICY IF EXISTS "admin_manage_routes" ON public.routes;
DROP POLICY IF EXISTS "admin_view_routes" ON public.routes;
DROP POLICY IF EXISTS "routes_driver_read" ON public.routes;
DROP POLICY IF EXISTS "routes_driver_update" ON public.routes;
DROP POLICY IF EXISTS "routes_admin_all" ON public.routes;

-- stops
DROP POLICY IF EXISTS "Drivers can view stops for their routes" ON public.stops;
DROP POLICY IF EXISTS "admin_manage_stops" ON public.stops;
DROP POLICY IF EXISTS "stops_driver_read" ON public.stops;
DROP POLICY IF EXISTS "stops_admin_all" ON public.stops;

-- invoices
DROP POLICY IF EXISTS "Admins/Finance manage invoices v2" ON public.invoices;
DROP POLICY IF EXISTS "invoices_admin_finance" ON public.invoices;

-- WEEKLY_PAY
DROP POLICY IF EXISTS "Enable all for finance and admin on WEEKLY_PAY" ON public."WEEKLY_PAY";
DROP POLICY IF EXISTS "Drivers can view their own WEEKLY_PAY" ON public."WEEKLY_PAY";
DROP POLICY IF EXISTS "weekly_pay_admin_finance" ON public."WEEKLY_PAY";
DROP POLICY IF EXISTS "weekly_pay_driver_read" ON public."WEEKLY_PAY";

-- DAILY_PAY_QTY
DROP POLICY IF EXISTS "Enable all for finance and admin on DAILY_PAY_QTY" ON public."DAILY_PAY_QTY";
DROP POLICY IF EXISTS "daily_pay_qty_admin_finance" ON public."DAILY_PAY_QTY";

-- DAILY_PAY_SUMMARY
DROP POLICY IF EXISTS "Enable all for finance and admin on DAILY_PAY_SUMMARY" ON public."DAILY_PAY_SUMMARY";
DROP POLICY IF EXISTS "Drivers can view their own DAILY_PAY_SUMMARY" ON public."DAILY_PAY_SUMMARY";
DROP POLICY IF EXISTS "daily_pay_summary_admin_finance" ON public."DAILY_PAY_SUMMARY";
DROP POLICY IF EXISTS "daily_pay_summary_driver_read" ON public."DAILY_PAY_SUMMARY";

-- ADJUSTMENT_DETAIL
DROP POLICY IF EXISTS "Enable all for finance and admin on ADJUSTMENT_DETAIL" ON public."ADJUSTMENT_DETAIL";
DROP POLICY IF EXISTS "Drivers can view their own ADJUSTMENT_DETAIL" ON public."ADJUSTMENT_DETAIL";
DROP POLICY IF EXISTS "adj_detail_admin_finance" ON public."ADJUSTMENT_DETAIL";
DROP POLICY IF EXISTS "adj_detail_driver_read" ON public."ADJUSTMENT_DETAIL";

-- ADJUSTMENT_SUMMARY
DROP POLICY IF EXISTS "Enable all for finance and admin on ADJUSTMENT_SUMMARY" ON public."ADJUSTMENT_SUMMARY";
DROP POLICY IF EXISTS "adj_summary_admin_finance" ON public."ADJUSTMENT_SUMMARY";

-- payslips
DROP POLICY IF EXISTS "Admins and Finance can manage payslips" ON public.payslips;
DROP POLICY IF EXISTS "Drivers can view their own payslips" ON public.payslips;
DROP POLICY IF EXISTS "payslips_admin_finance" ON public.payslips;
DROP POLICY IF EXISTS "payslips_driver_read" ON public.payslips;

-- earnings
DROP POLICY IF EXISTS "Drivers can view their own earnings" ON public.earnings;
DROP POLICY IF EXISTS "earnings_driver_read" ON public.earnings;
DROP POLICY IF EXISTS "earnings_admin_finance" ON public.earnings;

-- deductions
DROP POLICY IF EXISTS "Drivers can view their own deductions" ON public.deductions;
DROP POLICY IF EXISTS "deductions_driver_read" ON public.deductions;
DROP POLICY IF EXISTS "deductions_admin_finance" ON public.deductions;

-- pay_statements
DROP POLICY IF EXISTS "Drivers can view their own pay statements" ON public.pay_statements;
DROP POLICY IF EXISTS "pay_statements_driver_read" ON public.pay_statements;
DROP POLICY IF EXISTS "pay_statements_admin_finance" ON public.pay_statements;

-- supplier_rates
DROP POLICY IF EXISTS "Admins and Finance can manage supplier rates" ON public.supplier_rates;
DROP POLICY IF EXISTS "supplier_rates_admin_finance" ON public.supplier_rates;

-- driver_rates
DROP POLICY IF EXISTS "Admins and Finance can manage driver rates" ON public.driver_rates;
DROP POLICY IF EXISTS "Drivers can view their own rates" ON public.driver_rates;
DROP POLICY IF EXISTS "driver_rates_admin_finance" ON public.driver_rates;
DROP POLICY IF EXISTS "driver_rates_driver_read" ON public.driver_rates;

-- pay_rates
DROP POLICY IF EXISTS "Admins and Finance can view pay rates" ON public.pay_rates;
DROP POLICY IF EXISTS "Admins and Finance can insert pay rates" ON public.pay_rates;
DROP POLICY IF EXISTS "Admins and Finance can update pay rates" ON public.pay_rates;
DROP POLICY IF EXISTS "Admins and Finance can delete pay rates" ON public.pay_rates;
DROP POLICY IF EXISTS "pay_rates_admin_finance" ON public.pay_rates;

-- rate_status
DROP POLICY IF EXISTS "Admins and Finance can manage rate_status" ON public.rate_status;
DROP POLICY IF EXISTS "Authenticated users can view rate_status" ON public.rate_status;
DROP POLICY IF EXISTS "rate_status_admin_finance" ON public.rate_status;
DROP POLICY IF EXISTS "rate_status_authenticated_read" ON public.rate_status;

-- dispatchers
DROP POLICY IF EXISTS "admin_view_dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "dispatchers_admin_all" ON public.dispatchers;
DROP POLICY IF EXISTS "dispatchers_read_tenant" ON public.dispatchers;

-- messages
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;
DROP POLICY IF EXISTS "messages_participant_read" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_receiver_update" ON public.messages;

-- notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_read" ON public.notifications;
DROP POLICY IF EXISTS "notif_delete" ON public.notifications;
DROP POLICY IF EXISTS "notifications_participant_read" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

-- notification_settings
DROP POLICY IF EXISTS "Users can view own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can insert own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can update own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "notif_settings_self" ON public.notification_settings;

-- incidents
DROP POLICY IF EXISTS "Drivers can view their own incidents" ON public.incidents;
DROP POLICY IF EXISTS "Drivers can insert their own incidents" ON public.incidents;
DROP POLICY IF EXISTS "incidents_driver_read" ON public.incidents;
DROP POLICY IF EXISTS "incidents_driver_insert" ON public.incidents;
DROP POLICY IF EXISTS "incidents_admin_read" ON public.incidents;

-- onboarding_sessions
DROP POLICY IF EXISTS "Users can view their own onboarding session" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "Users can insert their own onboarding session" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "Users can update their own onboarding session" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "Admins can view all onboarding sessions" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "Admins can update onboarding session status" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "Onboarding sessions require authentication" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "onboarding_self_read" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "onboarding_self_insert" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "onboarding_self_update" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "onboarding_admin_read" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "onboarding_admin_update" ON public.onboarding_sessions;

-- driver_documents
DROP POLICY IF EXISTS "Admins can manage all driver documents" ON public.driver_documents;
DROP POLICY IF EXISTS "Drivers can view their own documents" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_docs_admin" ON public.driver_documents;
DROP POLICY IF EXISTS "driver_docs_self_read" ON public.driver_documents;

-- training_items
DROP POLICY IF EXISTS "Admins can manage training items" ON public.training_items;
DROP POLICY IF EXISTS "Authenticated users can view training items" ON public.training_items;
DROP POLICY IF EXISTS "training_items_admin" ON public.training_items;
DROP POLICY IF EXISTS "training_items_read" ON public.training_items;

-- driver_training_progress
DROP POLICY IF EXISTS "Admins can manage all training progress" ON public.driver_training_progress;
DROP POLICY IF EXISTS "Drivers can view their own training progress" ON public.driver_training_progress;
DROP POLICY IF EXISTS "training_progress_admin" ON public.driver_training_progress;
DROP POLICY IF EXISTS "training_progress_driver_read" ON public.driver_training_progress;

-- activity_logs
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_admin_read" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;

-- company_details
DROP POLICY IF EXISTS "Authenticated users can read company details" ON public.company_details;
DROP POLICY IF EXISTS "Admins and Finance can manage company details" ON public.company_details;
DROP POLICY IF EXISTS "company_details_read" ON public.company_details;
DROP POLICY IF EXISTS "company_details_admin_finance" ON public.company_details;

-- internal_expenses
DROP POLICY IF EXISTS "Admins and Finance can manage internal expenses" ON public.internal_expenses;
DROP POLICY IF EXISTS "internal_expenses_admin_finance" ON public.internal_expenses;

-- ===================================================================
-- 3. ENABLE RLS ON ALL TABLES (idempotent)
-- ===================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WEEKLY_PAY" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DAILY_PAY_QTY" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DAILY_PAY_SUMMARY" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ADJUSTMENT_DETAIL" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ADJUSTMENT_SUMMARY" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_expenses ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 4. RECREATE ALL POLICIES — NO direct user_roles subqueries anywhere
-- ===================================================================

-- -------------------------------------------------------------------
-- TENANTS
-- -------------------------------------------------------------------
CREATE POLICY "tenants_master_all" ON public.tenants
  FOR ALL USING (is_master_admin()) WITH CHECK (is_master_admin());

CREATE POLICY "tenants_own_read" ON public.tenants
  FOR SELECT USING (id = get_my_tenant_id());

CREATE POLICY "tenants_own_update" ON public.tenants
  FOR UPDATE USING (
    id = get_my_tenant_id()
    AND has_role_in_tenant(ARRAY['admin'::app_role], id)
  );

-- -------------------------------------------------------------------
-- USER_ROLES  (no self-referencing subqueries!)
-- -------------------------------------------------------------------
CREATE POLICY "ur_self_read" ON public.user_roles
  FOR SELECT USING (is_master_admin() OR user_id = auth.uid());

CREATE POLICY "ur_tenant_admin_read" ON public.user_roles
  FOR SELECT USING (
    is_master_admin()
    OR has_role_in_tenant(ARRAY['admin'::app_role, 'hr'::app_role], tenant_id)
  );

CREATE POLICY "ur_tenant_admin_insert" ON public.user_roles
  FOR INSERT WITH CHECK (
    is_master_admin()
    OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

CREATE POLICY "ur_tenant_admin_update" ON public.user_roles
  FOR UPDATE USING (
    is_master_admin()
    OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

CREATE POLICY "ur_tenant_admin_delete" ON public.user_roles
  FOR DELETE USING (
    is_master_admin()
    OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- STAFF_PROFILES
-- -------------------------------------------------------------------
CREATE POLICY "sp_self_read" ON public.staff_profiles
  FOR SELECT USING (is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid()));

CREATE POLICY "sp_self_update" ON public.staff_profiles
  FOR UPDATE USING (is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid()))
  WITH CHECK (is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid()));

CREATE POLICY "sp_admin_read" ON public.staff_profiles
  FOR SELECT USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['admin'::app_role]))
  );

CREATE POLICY "sp_admin_insert" ON public.staff_profiles
  FOR INSERT WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['admin'::app_role]))
  );

CREATE POLICY "sp_admin_update" ON public.staff_profiles
  FOR UPDATE USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['admin'::app_role]))
  ) WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['admin'::app_role]))
  );

CREATE POLICY "sp_hr_read" ON public.staff_profiles
  FOR SELECT USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['hr'::app_role]))
  );

CREATE POLICY "sp_hr_insert" ON public.staff_profiles
  FOR INSERT WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['hr'::app_role]))
  );

CREATE POLICY "sp_hr_update" ON public.staff_profiles
  FOR UPDATE USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['hr'::app_role]))
  ) WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['hr'::app_role]))
  );

CREATE POLICY "sp_driver_read_for_messaging" ON public.staff_profiles
  FOR SELECT USING (
    is_master_admin()
    OR (
      tenant_id = get_my_tenant_id()
      AND has_any_role(ARRAY['driver'::app_role])
      AND has_role(staff_profiles.user_id, 'admin')
    )
  );

-- -------------------------------------------------------------------
-- DRIVER_PROFILES
-- -------------------------------------------------------------------
CREATE POLICY "dp_self_read" ON public.driver_profiles
  FOR SELECT USING (is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid()));

CREATE POLICY "dp_self_update" ON public.driver_profiles
  FOR UPDATE USING (is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid()))
  WITH CHECK (is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid()));

CREATE POLICY "dp_admin_read" ON public.driver_profiles
  FOR SELECT USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['admin'::app_role]))
  );

CREATE POLICY "dp_admin_update" ON public.driver_profiles
  FOR UPDATE USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['admin'::app_role]))
  );

CREATE POLICY "dp_admin_insert" ON public.driver_profiles
  FOR INSERT WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['admin'::app_role, 'hr'::app_role]))
  );

CREATE POLICY "dp_hr_read" ON public.driver_profiles
  FOR SELECT USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['hr'::app_role]))
  );

CREATE POLICY "dp_hr_update" ON public.driver_profiles
  FOR UPDATE USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['hr'::app_role]))
  );

CREATE POLICY "dp_finance_read" ON public.driver_profiles
  FOR SELECT USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND has_any_role(ARRAY['finance'::app_role]))
  );

-- -------------------------------------------------------------------
-- ROUTES
-- -------------------------------------------------------------------
CREATE POLICY "routes_driver_read" ON public.routes
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "routes_driver_update" ON public.routes
  FOR UPDATE USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "routes_admin_all" ON public.routes
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- STOPS
-- -------------------------------------------------------------------
CREATE POLICY "stops_driver_read" ON public.stops
  FOR SELECT USING (
    is_master_admin()
    OR (
      tenant_id = get_my_tenant_id()
      AND route_id IN (
        SELECT r.id FROM routes r
        WHERE r.driver_id IN (SELECT dp.id FROM driver_profiles dp WHERE dp.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "stops_admin_all" ON public.stops
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- INVOICES
-- -------------------------------------------------------------------
CREATE POLICY "invoices_admin_finance" ON public.invoices
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- WEEKLY_PAY
-- -------------------------------------------------------------------
CREATE POLICY "weekly_pay_admin_finance" ON public."WEEKLY_PAY"
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

CREATE POLICY "weekly_pay_driver_read" ON public."WEEKLY_PAY"
  FOR SELECT USING (
    is_master_admin()
    OR (
      tenant_id = get_my_tenant_id()
      AND EXISTS (SELECT 1 FROM driver_profiles d WHERE d.user_id = auth.uid() AND d.operator_id = "WEEKLY_PAY".operator_id)
    )
  );

-- -------------------------------------------------------------------
-- DAILY_PAY_QTY
-- -------------------------------------------------------------------
CREATE POLICY "daily_pay_qty_admin_finance" ON public."DAILY_PAY_QTY"
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- DAILY_PAY_SUMMARY
-- -------------------------------------------------------------------
CREATE POLICY "daily_pay_summary_admin_finance" ON public."DAILY_PAY_SUMMARY"
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

CREATE POLICY "daily_pay_summary_driver_read" ON public."DAILY_PAY_SUMMARY"
  FOR SELECT USING (
    is_master_admin()
    OR (
      tenant_id = get_my_tenant_id()
      AND EXISTS (SELECT 1 FROM driver_profiles d WHERE d.user_id = auth.uid() AND d.operator_id = "DAILY_PAY_SUMMARY".operator_id)
    )
  );

-- -------------------------------------------------------------------
-- ADJUSTMENT_DETAIL
-- -------------------------------------------------------------------
CREATE POLICY "adj_detail_admin_finance" ON public."ADJUSTMENT_DETAIL"
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

CREATE POLICY "adj_detail_driver_read" ON public."ADJUSTMENT_DETAIL"
  FOR SELECT USING (
    is_master_admin()
    OR (
      tenant_id = get_my_tenant_id()
      AND EXISTS (SELECT 1 FROM driver_profiles d WHERE d.user_id = auth.uid() AND d.operator_id = "ADJUSTMENT_DETAIL".operator_id)
    )
  );

-- -------------------------------------------------------------------
-- ADJUSTMENT_SUMMARY
-- -------------------------------------------------------------------
CREATE POLICY "adj_summary_admin_finance" ON public."ADJUSTMENT_SUMMARY"
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- PAYSLIPS
-- -------------------------------------------------------------------
CREATE POLICY "payslips_admin_finance" ON public.payslips
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

CREATE POLICY "payslips_driver_read" ON public.payslips
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

-- -------------------------------------------------------------------
-- EARNINGS
-- -------------------------------------------------------------------
CREATE POLICY "earnings_driver_read" ON public.earnings
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "earnings_admin_finance" ON public.earnings
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- DEDUCTIONS
-- -------------------------------------------------------------------
CREATE POLICY "deductions_driver_read" ON public.deductions
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "deductions_admin_finance" ON public.deductions
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- PAY_STATEMENTS
-- -------------------------------------------------------------------
CREATE POLICY "pay_statements_driver_read" ON public.pay_statements
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "pay_statements_admin_finance" ON public.pay_statements
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- SUPPLIER_RATES
-- -------------------------------------------------------------------
CREATE POLICY "supplier_rates_admin_finance" ON public.supplier_rates
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- DRIVER_RATES
-- -------------------------------------------------------------------
CREATE POLICY "driver_rates_admin_finance" ON public.driver_rates
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

CREATE POLICY "driver_rates_driver_read" ON public.driver_rates
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id = (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

-- -------------------------------------------------------------------
-- PAY_RATES
-- -------------------------------------------------------------------
CREATE POLICY "pay_rates_admin_finance" ON public.pay_rates
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- RATE_STATUS
-- -------------------------------------------------------------------
CREATE POLICY "rate_status_admin_finance" ON public.rate_status
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

CREATE POLICY "rate_status_tenant_read" ON public.rate_status
  FOR SELECT USING (is_master_admin() OR tenant_id = get_my_tenant_id());

-- -------------------------------------------------------------------
-- DISPATCHERS
-- -------------------------------------------------------------------
CREATE POLICY "dispatchers_admin_all" ON public.dispatchers
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

CREATE POLICY "dispatchers_tenant_read" ON public.dispatchers
  FOR SELECT USING (is_master_admin() OR tenant_id = get_my_tenant_id());

-- -------------------------------------------------------------------
-- MESSAGES
-- -------------------------------------------------------------------
CREATE POLICY "messages_participant_read" ON public.messages
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND (sender_id = auth.uid() OR receiver_id = auth.uid()))
  );

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND sender_id = auth.uid())
  );

CREATE POLICY "messages_receiver_update" ON public.messages
  FOR UPDATE USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND receiver_id = auth.uid())
  );

-- -------------------------------------------------------------------
-- NOTIFICATIONS
-- -------------------------------------------------------------------
CREATE POLICY "notif_read" ON public.notifications
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND (recipient_id = auth.uid() OR sender_id = auth.uid()))
  );

CREATE POLICY "notif_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND sender_id = auth.uid())
  );

CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND recipient_id = auth.uid())
  );

CREATE POLICY "notif_delete" ON public.notifications
  FOR DELETE USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND recipient_id = auth.uid())
  );

-- -------------------------------------------------------------------
-- NOTIFICATION_SETTINGS
-- -------------------------------------------------------------------
CREATE POLICY "notif_settings_self" ON public.notification_settings
  FOR ALL USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid())
  ) WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid())
  );

-- -------------------------------------------------------------------
-- INCIDENTS
-- -------------------------------------------------------------------
CREATE POLICY "incidents_driver_read" ON public.incidents
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "incidents_driver_insert" ON public.incidents
  FOR INSERT WITH CHECK (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "incidents_admin_read" ON public.incidents
  FOR SELECT USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- ONBOARDING_SESSIONS
-- -------------------------------------------------------------------
CREATE POLICY "onboarding_self_read" ON public.onboarding_sessions
  FOR SELECT USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid())
  );

CREATE POLICY "onboarding_self_insert" ON public.onboarding_sessions
  FOR INSERT WITH CHECK (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid())
  );

CREATE POLICY "onboarding_self_update" ON public.onboarding_sessions
  FOR UPDATE USING (
    is_master_admin() OR (tenant_id = get_my_tenant_id() AND user_id = auth.uid())
  );

CREATE POLICY "onboarding_admin_read" ON public.onboarding_sessions
  FOR SELECT USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

CREATE POLICY "onboarding_admin_update" ON public.onboarding_sessions
  FOR UPDATE USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

-- -------------------------------------------------------------------
-- DRIVER_DOCUMENTS
-- -------------------------------------------------------------------
CREATE POLICY "driver_docs_admin" ON public.driver_documents
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

CREATE POLICY "driver_docs_self_read" ON public.driver_documents
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

-- -------------------------------------------------------------------
-- TRAINING_ITEMS
-- -------------------------------------------------------------------
CREATE POLICY "training_items_admin" ON public.training_items
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

CREATE POLICY "training_items_tenant_read" ON public.training_items
  FOR SELECT USING (is_master_admin() OR tenant_id = get_my_tenant_id());

-- -------------------------------------------------------------------
-- DRIVER_TRAINING_PROGRESS
-- -------------------------------------------------------------------
CREATE POLICY "training_progress_admin" ON public.driver_training_progress
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

CREATE POLICY "training_progress_driver_read" ON public.driver_training_progress
  FOR SELECT USING (
    is_master_admin()
    OR (tenant_id = get_my_tenant_id() AND driver_id IN (SELECT id FROM driver_profiles WHERE user_id = auth.uid()))
  );

-- -------------------------------------------------------------------
-- ACTIVITY_LOGS
-- -------------------------------------------------------------------
CREATE POLICY "activity_logs_admin_read" ON public.activity_logs
  FOR SELECT USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (
    is_master_admin() OR tenant_id = get_my_tenant_id()
  );

-- -------------------------------------------------------------------
-- COMPANY_DETAILS (legacy)
-- -------------------------------------------------------------------
CREATE POLICY "company_details_read" ON public.company_details
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "company_details_admin_finance" ON public.company_details
  FOR ALL USING (
    is_master_admin() OR has_any_role(ARRAY['admin'::app_role, 'finance'::app_role])
  );

-- -------------------------------------------------------------------
-- INTERNAL_EXPENSES
-- -------------------------------------------------------------------
CREATE POLICY "internal_expenses_admin_finance" ON public.internal_expenses
  FOR ALL USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id)
  );

COMMIT;
