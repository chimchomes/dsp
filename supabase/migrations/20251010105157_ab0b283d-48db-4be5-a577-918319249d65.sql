-- Add status and approval tracking to expenses table
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE public.expenses 
ADD COLUMN status expense_status NOT NULL DEFAULT 'pending',
ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN reviewed_at timestamp with time zone,
ADD COLUMN rejection_reason text;

-- Create index for faster status queries
CREATE INDEX idx_expenses_status ON public.expenses(status);

-- Add RLS policy for finance/admin to update expense status
CREATE POLICY "Finance and admins can update expense status"
ON public.expenses
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'dispatcher')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'dispatcher')
);

-- Add RLS policy for finance/admin to view all expenses
CREATE POLICY "Finance and admins can view all expenses"
ON public.expenses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'dispatcher')
);