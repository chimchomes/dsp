-- Add DSP parcel rate field to dispatchers table
-- This is the rate the DSP charges/gets paid per parcel (separate from driver_parcel_rate)
-- This field is used for revenue calculations and financial reporting

ALTER TABLE public.dispatchers
ADD COLUMN IF NOT EXISTS dsp_parcel_rate NUMERIC(10, 2) DEFAULT 0;

-- Add comment to clarify the difference between dsp_parcel_rate and driver_parcel_rate
COMMENT ON COLUMN public.dispatchers.dsp_parcel_rate IS 'Rate the DSP charges/gets paid per parcel (revenue rate). This is separate from driver_parcel_rate which is what the driver gets paid.';
COMMENT ON COLUMN public.dispatchers.driver_parcel_rate IS 'Rate paid to driver per successfully completed parcel (driver payout rate).';

