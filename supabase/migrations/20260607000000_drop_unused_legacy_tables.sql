-- Remove legacy dispatcher/route payroll schema and other unused tables.
-- The app uses driver_profiles, notifications, tour_rates, and quoted invoice tables.

DROP TRIGGER IF EXISTS user_role_profile_check ON public.user_roles;
DROP FUNCTION IF EXISTS public.ensure_profile_exists();

DROP TABLE IF EXISTS public.stops CASCADE;
DROP TABLE IF EXISTS public.routes CASCADE;
DROP TABLE IF EXISTS public.dispatchers CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.earnings CASCADE;
DROP TABLE IF EXISTS public.deductions CASCADE;
DROP TABLE IF EXISTS public.pay_statements CASCADE;
DROP TABLE IF EXISTS public.driver_documents CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.company_details CASCADE;
DROP TABLE IF EXISTS public.supplier_rates CASCADE;
DROP TABLE IF EXISTS public.pay_rates CASCADE;
DROP TABLE IF EXISTS public.rate_status CASCADE;
DROP TABLE IF EXISTS public.weekly_pay CASCADE;
DROP TABLE IF EXISTS public.daily_pay CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
