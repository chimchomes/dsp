-- Add email column to onboarding_sessions table
ALTER TABLE public.onboarding_sessions
ADD COLUMN email text;