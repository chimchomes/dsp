-- Drop the existing check constraint
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_type_check;

-- Add updated check constraint with all action types (existing and new)
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_action_type_check 
CHECK (action_type IN (
  'login',
  'logout',
  'user_role_assigned',
  'user_role_removed',
  'route_created',
  'route_updated',
  'route_deleted',
  'driver_created',
  'driver_updated',
  'driver_activated',
  'driver_deactivated',
  'onboarding_submitted',
  'onboarding_session_created',
  'onboarding_session_updated'
));