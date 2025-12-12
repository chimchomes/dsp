-- Part 3: Link expenses to routes for payroll calculation
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL;

-- Add index for route_id lookups
CREATE INDEX IF NOT EXISTS idx_expenses_route_id ON public.expenses(route_id);

-- Update RLS policy to allow drivers to view expenses linked to their routes
-- (This is already covered by existing driver_id policy, but we ensure route linking works)

