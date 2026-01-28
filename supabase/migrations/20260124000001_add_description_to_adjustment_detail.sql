-- Add description column to ADJUSTMENT_DETAIL table if it doesn't exist
ALTER TABLE public."ADJUSTMENT_DETAIL"
ADD COLUMN IF NOT EXISTS description TEXT;
