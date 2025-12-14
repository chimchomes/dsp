-- Add fields for route completion details
ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS parcels_undelivered INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS undelivered_reason TEXT,
ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.routes.parcels_undelivered IS 'Number of parcels that could not be delivered';
COMMENT ON COLUMN public.routes.undelivered_reason IS 'Reason for undelivered parcels (e.g., "Customer not available", "Wrong address", "Damaged")';
COMMENT ON COLUMN public.routes.completion_notes IS 'Additional notes from driver about route completion';

