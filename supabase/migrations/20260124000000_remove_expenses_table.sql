-- Remove expenses table and all associated objects
-- This migration removes the expenses table since expenses functionality has been removed from the app

-- Drop foreign key constraints first
ALTER TABLE public.expenses 
DROP CONSTRAINT IF EXISTS expenses_driver_id_fkey,
DROP CONSTRAINT IF EXISTS expenses_route_id_fkey,
DROP CONSTRAINT IF EXISTS expenses_reviewed_by_fkey;

-- Drop indexes
DROP INDEX IF EXISTS idx_expenses_route_id;
DROP INDEX IF EXISTS idx_expenses_status;

-- Drop RLS policies
DROP POLICY IF EXISTS "Finance and admins can update expense status" ON public.expenses;
DROP POLICY IF EXISTS "Finance and admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Drivers can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Drivers can insert their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Drivers can update their own pending expenses" ON public.expenses;

-- Drop the expenses table
DROP TABLE IF EXISTS public.expenses;

-- Note: We keep the expense_status enum type in case it's referenced elsewhere
-- If you want to remove it, uncomment the following:
-- DROP TYPE IF EXISTS public.expense_status;
