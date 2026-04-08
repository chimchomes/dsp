-- Allow HR to manage role assignment/removal within their tenant.
-- This supports HR activate/deactivate flows for staff and drivers.

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
  v_actor_tenant_id UUID;
  v_target_tenant_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin')
     AND NOT has_role(auth.uid(), 'hr')
     AND NOT has_role(auth.uid(), 'master_admin') THEN
    RAISE EXCEPTION 'Only admin, HR, or master admin can assign roles';
  END IF;

  IF has_role(auth.uid(), 'master_admin') THEN
    -- For master admin, prefer existing tenant context of the target user.
    SELECT ur.tenant_id INTO v_target_tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.tenant_id IS NOT NULL
    ORDER BY ur.created_at DESC
    LIMIT 1;

    IF v_target_tenant_id IS NULL THEN
      -- Fallback for first-time role assignments.
      SELECT t.id INTO v_target_tenant_id
      FROM public.tenants t
      ORDER BY t.created_at ASC
      LIMIT 1;
    END IF;
  ELSE
    v_actor_tenant_id := get_my_tenant_id();
    IF v_actor_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Could not resolve tenant context for role assignment';
    END IF;
    v_target_tenant_id := v_actor_tenant_id;

    -- Non-master users cannot assign roles across tenants.
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = p_user_id
        AND ur.tenant_id IS NOT NULL
        AND ur.tenant_id <> v_target_tenant_id
    ) THEN
      RAISE EXCEPTION 'Cannot assign role for a user outside your tenant';
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (p_user_id, p_role, v_target_tenant_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM log_activity(
    'user_role_assigned',
    'user',
    p_user_id,
    jsonb_build_object('role', p_role, 'tenant_id', v_target_tenant_id)
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
DECLARE
  v_actor_tenant_id UUID;
BEGIN
  IF NOT has_role(auth.uid(), 'admin')
     AND NOT has_role(auth.uid(), 'hr')
     AND NOT has_role(auth.uid(), 'master_admin') THEN
    RAISE EXCEPTION 'Only admin, HR, or master admin can remove roles';
  END IF;

  IF has_role(auth.uid(), 'master_admin') THEN
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = p_role;
  ELSE
    v_actor_tenant_id := get_my_tenant_id();
    IF v_actor_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Could not resolve tenant context for role removal';
    END IF;

    DELETE FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = p_role
      AND tenant_id = v_actor_tenant_id;
  END IF;

  PERFORM log_activity(
    'user_role_removed',
    'user',
    p_user_id,
    jsonb_build_object('role', p_role)
  );
END;
$$;
