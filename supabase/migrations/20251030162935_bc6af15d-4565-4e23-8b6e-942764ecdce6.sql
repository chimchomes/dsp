-- Remove the overly permissive authentication-only policy
-- All access should be role-based, not just authenticated-based
DROP POLICY IF EXISTS "Drivers table requires authentication" ON public.drivers;

-- Verify all existing policies are restrictive and role-based:
-- 1. "Dispatchers can view drivers they manage" - ✓ Role-based (dispatcher/admin) + relationship check
-- 2. "Finance can view drivers for payroll" - ✓ Role-based (finance) + active status check
-- 3. "Drivers can view their own record" - ✓ Owner-based (email match)
-- 4. "Admins can insert drivers" - ✓ Role-based (admin)
-- 5. "Admins can update drivers" - ✓ Role-based (admin)

-- No changes needed - existing policies are already properly restrictive