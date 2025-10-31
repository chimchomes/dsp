-- Fix training_items public exposure
-- Remove the overly permissive policy that allows anyone to view training materials
DROP POLICY IF EXISTS "Everyone can view training items" ON public.training_items;

-- Create a new policy that restricts access to authenticated users only
CREATE POLICY "Authenticated users can view training items"
ON public.training_items
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);