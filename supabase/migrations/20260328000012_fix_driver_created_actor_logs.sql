-- Ensure driver activity logs capture creator identity instead of appearing as "System"
-- when rows are created/updated by admin/hr workflows.

CREATE OR REPLACE FUNCTION public.log_driver_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_email TEXT;
  v_payload JSONB;
BEGIN
  v_actor_user_id := COALESCE(auth.uid(), NEW.onboarded_by, OLD.onboarded_by);

  IF v_actor_user_id IS NOT NULL THEN
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = v_actor_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_payload := to_jsonb(NEW)
      || jsonb_build_object(
        'created_by_user_id', v_actor_user_id,
        'created_by_email', v_actor_email
      );
    PERFORM log_activity('driver_created', 'driver', NEW.id, v_payload);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.active IS DISTINCT FROM NEW.active THEN
      v_payload := to_jsonb(NEW)
        || jsonb_build_object(
          'created_by_user_id', v_actor_user_id,
          'created_by_email', v_actor_email
        );
      IF NEW.active THEN
        PERFORM log_activity('driver_activated', 'driver', NEW.id, v_payload);
      ELSE
        PERFORM log_activity('driver_deactivated', 'driver', NEW.id, v_payload);
      END IF;
    ELSE
      v_payload := jsonb_build_object(
        'old', to_jsonb(OLD),
        'new', to_jsonb(NEW),
        'created_by_user_id', v_actor_user_id,
        'created_by_email', v_actor_email
      );
      PERFORM log_activity('driver_updated', 'driver', NEW.id, v_payload);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Backfill existing driver_created logs where onboarded_by is available in action_details
-- so Activity Logs can show the acting user for historical rows too.
UPDATE public.activity_logs al
SET action_details = COALESCE(al.action_details, '{}'::jsonb) || jsonb_build_object(
  'created_by_user_id', u.id,
  'created_by_email', u.email
)
FROM auth.users u
WHERE al.action_type = 'driver_created'
  AND COALESCE(al.user_email, '') = ''
  AND al.action_details ? 'onboarded_by'
  AND u.id = (al.action_details->>'onboarded_by')::uuid
  AND NOT (al.action_details ? 'created_by_email');
