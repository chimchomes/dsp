-- Add status and approval tracking to expenses table
DO $$
BEGIN
  -- Add new values to expense_status if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.expense_status'::regtype AND enumlabel = 'declined') THEN
    ALTER TYPE public.expense_status ADD VALUE 'declined';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.expense_status'::regtype AND enumlabel = 'confirmed') THEN
    ALTER TYPE public.expense_status ADD VALUE 'confirmed';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'cost') THEN
    ALTER TABLE public.expenses 
    RENAME COLUMN cost TO amount;
  END IF;
END
$$;

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS status public.expense_status NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS confirmation_date timestamp with time zone;

-- Create index for faster status queries
DROP INDEX IF EXISTS idx_expenses_status;
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);

-- Add RLS policy for finance/admin to update expense status
DROP POLICY IF EXISTS "Finance and admins can update expense status" ON public.expenses;
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
DROP POLICY IF EXISTS "Finance and admins can view all expenses" ON public.expenses;
CREATE POLICY "Finance and admins can view all expenses"
ON public.expenses
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'dispatcher')
);