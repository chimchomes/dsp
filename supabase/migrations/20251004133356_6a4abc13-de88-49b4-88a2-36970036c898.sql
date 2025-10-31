-- Create activity_logs table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'login', 'logout', 'route_created', 'route_updated', 'route_deleted',
    'driver_created', 'driver_updated', 'driver_deactivated', 'driver_activated',
    'message_sent', 'incident_reported', 'expense_submitted',
    'deduction_created', 'payout_calculated', 'payout_processed',
    'training_completed', 'document_uploaded', 'user_role_assigned',
    'user_role_removed', 'settings_changed'
  )),
  resource_type TEXT,
  resource_id UUID,
  action_details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action_type ON public.activity_logs(action_type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_resource ON public.activity_logs(resource_type, resource_id);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_logs
CREATE POLICY "Admins can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (true);

-- Create function to log activity
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
BEGIN
  -- Get current user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Insert activity log
  INSERT INTO public.activity_logs (
    user_id,
    user_email,
    action_type,
    resource_type,
    resource_id,
    action_details
  )
  VALUES (
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

-- Add RLS policies for admins to manage user roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create function to assign role to user
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id UUID,
  p_role app_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign roles';
  END IF;

  -- Insert or update role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Log the action
  PERFORM log_activity(
    'user_role_assigned',
    'user',
    p_user_id,
    jsonb_build_object('role', p_role)
  );
END;
$$;

-- Create function to remove role from user
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
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can remove roles';
  END IF;

  -- Delete role
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = p_role;

  -- Log the action
  PERFORM log_activity(
    'user_role_removed',
    'user',
    p_user_id,
    jsonb_build_object('role', p_role)
  );
END;
$$;

-- Create triggers to automatically log important actions
CREATE OR REPLACE FUNCTION public.log_route_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity('route_created', 'route', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_activity('route_updated', 'route', NEW.id, 
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_activity('route_deleted', 'route', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER route_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.routes
FOR EACH ROW EXECUTE FUNCTION log_route_changes();

-- Create trigger for driver changes
CREATE OR REPLACE FUNCTION public.log_driver_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity('driver_created', 'driver', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.active != NEW.active THEN
      IF NEW.active THEN
        PERFORM log_activity('driver_activated', 'driver', NEW.id, to_jsonb(NEW));
      ELSE
        PERFORM log_activity('driver_deactivated', 'driver', NEW.id, to_jsonb(NEW));
      END IF;
    ELSE
      PERFORM log_activity('driver_updated', 'driver', NEW.id,
        jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER driver_audit_trigger
AFTER INSERT OR UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION log_driver_changes();

-- Enable realtime for activity_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;