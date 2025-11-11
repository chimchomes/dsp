-- Add updated_at column to drivers table
-- This column is referenced in the code but was missing from the schema

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger to automatically update updated_at on driver updates
-- Use the existing update_updated_at_column function (already created for routes table)
DROP TRIGGER IF EXISTS update_drivers_updated_at ON public.drivers;
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON COLUMN public.drivers.updated_at IS 'Timestamp when the driver record was last updated';

