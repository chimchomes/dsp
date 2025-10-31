-- Update RLS policy to allow finance role to view all expenses
DROP POLICY IF EXISTS "Finance and admins can view all expenses" ON expenses;

CREATE POLICY "Finance and admins can view all expenses"
ON expenses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'dispatcher'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
);

-- Update RLS policy for updating expenses to include finance role
DROP POLICY IF EXISTS "Finance and admins can update expense status" ON expenses;

CREATE POLICY "Finance and admins can update expense status"
ON expenses
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'dispatcher'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'dispatcher'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
);