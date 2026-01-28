-- SIMPLE FIX - Just add the policy, nothing else
DROP POLICY IF EXISTS "Finance can view active drivers" ON public.drivers;

CREATE POLICY "Finance can view active drivers" ON public.drivers
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'finance'::app_role)
);
