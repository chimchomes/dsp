-- Update assign_user_role and remove_user_role to be tenant-aware.
-- The caller's tenant_id is automatically derived from their user_roles record.

CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id UUID,
  p_role app_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') AND NOT has_role(auth.uid(), 'master_admin') THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND tenant_id IS NOT NULL
  LIMIT 1;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (p_user_id, p_role, v_tenant_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM log_activity(
    'user_role_assigned',
    'user',
    p_user_id,
    jsonb_build_object('role', p_role, 'tenant_id', v_tenant_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_user_role(
  p_user_id UUID,
  p_role app_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') AND NOT has_role(auth.uid(), 'master_admin') THEN
    RAISE EXCEPTION 'Only admins can remove roles';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = p_role;

  PERFORM log_activity(
    'user_role_removed',
    'user',
    p_user_id,
    jsonb_build_object('role', p_role)
  );
END;
$$;
