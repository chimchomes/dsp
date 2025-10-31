-- Add new fields to routes table for DSP functionality
ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS parcel_count_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parcels_delivered INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS postcodes_covered TEXT[],
ADD COLUMN IF NOT EXISTS amazon_rate_per_parcel NUMERIC DEFAULT 0;

-- Update routes status to include more detailed statuses
-- Note: keeping existing 'pending', 'completed', 'missed', 'delayed' statuses
-- Adding 'assigned', 'in_progress', 'paid' as additional valid status values

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_routes_status ON public.routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_dispatcher_id ON public.routes(dispatcher_id);
CREATE INDEX IF NOT EXISTS idx_routes_driver_status ON public.routes(driver_id, status);