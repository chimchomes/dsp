-- Add 're-submit' status to onboarding_sessions
-- Allow users to edit their application when admin sets status to re-submit

-- Drop the existing constraint
ALTER TABLE public.onboarding_sessions
DROP CONSTRAINT IF EXISTS onboarding_sessions_status_check;

-- Add new constraint with re-submit status
ALTER TABLE public.onboarding_sessions
ADD CONSTRAINT onboarding_sessions_status_check 
CHECK (status IN ('in_progress', 'submitted', 'accepted', 'rejected', 're-submit'));

-- Add comment
COMMENT ON COLUMN public.onboarding_sessions.status IS 'Status of the onboarding application: in_progress, submitted, accepted, rejected, re-submit';

