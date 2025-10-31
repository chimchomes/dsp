-- Remove the overly broad authentication policy on onboarding_sessions
-- The existing policies are already properly restrictive:
-- 1. Users can only view/insert/update their own sessions (user_id = auth.uid())
-- 2. Admins can view and update all sessions
-- No need for an additional blanket authentication policy

DROP POLICY IF EXISTS "Onboarding sessions require authentication" ON public.onboarding_sessions;