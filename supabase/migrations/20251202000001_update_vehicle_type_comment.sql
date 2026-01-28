-- Update comment for vehicle_type column to reflect new values
COMMENT ON COLUMN public.onboarding_sessions.vehicle_type IS 'Vehicle type: own vehicle or LEASED (used for pay rate allocation)';
