-- Store admin rejection reason on onboarding applications.
ALTER TABLE public.onboarding_sessions
ADD COLUMN IF NOT EXISTS rejection_comment TEXT;

COMMENT ON COLUMN public.onboarding_sessions.rejection_comment IS
'Admin-provided rejection reason shown to applicant for correction and resubmission.';
