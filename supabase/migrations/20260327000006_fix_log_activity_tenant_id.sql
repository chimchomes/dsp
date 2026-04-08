-- Ensure activity logs always include tenant_id in multi-tenant mode.
-- This fixes failures where log_activity() was inserting NULL tenant_id.

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action_type TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_action_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_email TEXT;
  v_tenant_id UUID;
BEGIN
  -- Resolve caller email (nullable for service flows).
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Resolve tenant with robust fallbacks for onboarding/public flows.
  v_tenant_id := COALESCE(
    get_my_tenant_id(),
    (SELECT ur.tenant_id
       FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id IS NOT NULL
      LIMIT 1),
    CASE
      WHEN p_resource_type = 'onboarding_session' THEN
        (SELECT os.tenant_id FROM public.onboarding_sessions os WHERE os.id = p_resource_id)
      WHEN p_resource_type = 'driver' THEN
        (SELECT dp.tenant_id FROM public.driver_profiles dp WHERE dp.id = p_resource_id)
      ELSE NULL
    END,
    (SELECT os2.tenant_id
       FROM public.onboarding_sessions os2
      WHERE os2.user_id = auth.uid()
      ORDER BY os2.created_at DESC
      LIMIT 1),
    (SELECT t.id FROM public.tenants t ORDER BY t.created_at ASC LIMIT 1)
  );

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve tenant for activity log';
  END IF;

  INSERT INTO public.activity_logs (
    tenant_id,
    user_id,
    user_email,
    action_type,
    resource_type,
    resource_id,
    action_details
  )
  VALUES (
    v_tenant_id,
    auth.uid(),
    v_user_email,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_action_details
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
