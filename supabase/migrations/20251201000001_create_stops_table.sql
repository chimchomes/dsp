-- Part 2: Create stops table for route stops with geocoding
CREATE TABLE IF NOT EXISTS public.stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  stop_sequence INTEGER NOT NULL,
  street_address TEXT NOT NULL,
  customer_name TEXT,
  package_details TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  geocoded BOOLEAN DEFAULT false,
  geocoding_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(route_id, stop_sequence)
);

-- Enable RLS on stops
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stops
CREATE POLICY "Drivers can view stops for their routes"
ON public.stops FOR SELECT
USING (
  route_id IN (
    SELECT id FROM public.routes 
    WHERE driver_id IN (
      SELECT id FROM public.drivers 
      WHERE email = auth.jwt()->>'email'
    )
  )
);

CREATE POLICY "Admins and dispatchers can manage stops"
ON public.stops FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'dispatcher'::app_role)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_stops_route_id ON public.stops(route_id);
CREATE INDEX IF NOT EXISTS idx_stops_sequence ON public.stops(route_id, stop_sequence);
CREATE INDEX IF NOT EXISTS idx_stops_geocoded ON public.stops(geocoded);

-- Add trigger for updated_at
CREATE TRIGGER update_stops_updated_at
BEFORE UPDATE ON public.stops
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

