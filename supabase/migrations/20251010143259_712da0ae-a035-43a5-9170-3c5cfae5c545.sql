-- Allow finance role to view drivers (needed for expense review)
CREATE POLICY "Finance can view all drivers"
ON drivers
FOR SELECT
USING (has_role(auth.uid(), 'finance'::app_role));