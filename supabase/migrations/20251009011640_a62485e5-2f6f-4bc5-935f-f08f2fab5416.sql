-- Add status field to onboarding_sessions
ALTER TABLE public.onboarding_sessions 
ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';

-- Add check constraint for valid statuses
ALTER TABLE public.onboarding_sessions
ADD CONSTRAINT onboarding_sessions_status_check 
CHECK (status IN ('in_progress', 'submitted', 'accepted', 'rejected'));

-- Create index for better query performance
CREATE INDEX idx_onboarding_sessions_status ON public.onboarding_sessions(status);

-- Add reviewed_by and reviewed_at columns for admin tracking
ALTER TABLE public.onboarding_sessions
ADD COLUMN reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;

-- Update RLS policies to allow admins to update status
CREATE POLICY "Admins can update onboarding session status"
ON public.onboarding_sessions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add comment
COMMENT ON COLUMN public.onboarding_sessions.status IS 'Status of the onboarding application: in_progress, submitted, accepted, rejected';