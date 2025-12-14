-- Add 'assigned' and 'in_progress' status values to routes table check constraint
-- The original constraint only allowed: 'pending', 'completed', 'missed', 'delayed'
-- We need 'assigned' for when a route is assigned to a driver but not yet started
-- We need 'in_progress' for when a driver is actively working on the route

-- Drop the old constraint
ALTER TABLE public.routes
DROP CONSTRAINT IF EXISTS routes_status_check;

-- Add the new constraint with all valid status values
ALTER TABLE public.routes
ADD CONSTRAINT routes_status_check 
CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'missed', 'delayed'));

-- Add comment to document the status values
COMMENT ON COLUMN public.routes.status IS 'Route status: pending (not assigned), assigned (assigned to driver), in_progress (driver is working on it), completed (successfully completed), missed (missed delivery), delayed (delayed delivery)';

