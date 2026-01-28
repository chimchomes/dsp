-- Remove vehicle_type from drivers table if it exists
ALTER TABLE public.drivers DROP COLUMN IF EXISTS vehicle_type;

-- Create rate_status table
CREATE TABLE IF NOT EXISTS public.rate_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_code TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on rate_status
ALTER TABLE public.rate_status ENABLE ROW LEVEL SECURITY;

-- Allow admins and finance to manage rate_status
CREATE POLICY "Admins and Finance can manage rate_status"
  ON public.rate_status
  FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance'));

-- Allow all authenticated users to view rate_status
CREATE POLICY "Authenticated users can view rate_status"
  ON public.rate_status
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert initial rate statuses
INSERT INTO public.rate_status (status_code, description)
VALUES 
  ('WEEKDAY-OV', 'Weekday Own Vehicle'),
  ('SPECIAL-OV', 'Special Own Vehicle')
ON CONFLICT (status_code) DO NOTHING;

-- Update supplier_rates table to use status_code from rate_status
-- First, ensure the status column can hold the new values
-- We'll keep status as TEXT but it should reference rate_status.status_code

-- Add comment to clarify the relationship
COMMENT ON COLUMN public.supplier_rates.status IS 'Status code from rate_status table (e.g., WEEKDAY-OV, SPECIAL-OV)';

COMMENT ON TABLE public.rate_status IS 'Rate status codes for supplier rates (e.g., WEEKDAY-OV, SPECIAL-OV)';
