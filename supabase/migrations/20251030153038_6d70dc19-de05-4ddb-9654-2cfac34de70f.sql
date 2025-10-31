-- Fix activity_logs insert policy to prevent public access
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert activity logs" ON public.activity_logs;

-- Create a new restrictive policy that only allows authenticated users
-- Since log_activity() is SECURITY DEFINER, it will bypass this policy
-- This prevents direct public inserts while allowing the system function to work
CREATE POLICY "Authenticated users can insert activity logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);