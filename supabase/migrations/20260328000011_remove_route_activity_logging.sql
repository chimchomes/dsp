-- Disable legacy route activity logging.
-- The product no longer uses route/dispatcher workflows in admin operations.

DROP TRIGGER IF EXISTS route_audit_trigger ON public.routes;
DROP FUNCTION IF EXISTS public.log_route_changes();
