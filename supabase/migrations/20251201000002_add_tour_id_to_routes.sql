-- Part 2: Add tour_id to routes table for route identification
ALTER TABLE public.routes
ADD COLUMN IF NOT EXISTS tour_id TEXT;

-- Add index for tour_id lookups
CREATE INDEX IF NOT EXISTS idx_routes_tour_id ON public.routes(tour_id);

-- Add unique constraint on tour_id per dispatcher (if needed)
-- Note: This allows same tour_id for different dispatchers
CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_tour_id_dispatcher 
ON public.routes(tour_id, dispatcher_id) 
WHERE tour_id IS NOT NULL AND dispatcher_id IS NOT NULL;

