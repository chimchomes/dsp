-- Create a function to get all available roles from the app_role enum
CREATE OR REPLACE FUNCTION public.get_available_roles()
RETURNS TABLE(role_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unnest(enum_range(NULL::app_role))::text;
$$;