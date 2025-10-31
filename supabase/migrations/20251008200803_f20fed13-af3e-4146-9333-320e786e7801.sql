-- Add onboarding role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'onboarding';

-- Create onboarding_sessions table to store progress
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_ownership_type TEXT NOT NULL CHECK (vehicle_ownership_type IN ('own', 'lease')),
  
  -- Personal information
  full_name TEXT,
  contact_phone TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  
  -- Driver details
  license_number TEXT,
  license_expiry DATE,
  
  -- Vehicle information (for own vehicle)
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_registration TEXT,
  
  -- Lease information (for leased vehicle)
  preferred_vehicle_type TEXT,
  lease_start_date DATE,
  
  -- Document uploads
  license_document_url TEXT,
  proof_of_address_url TEXT,
  right_to_work_url TEXT,
  vehicle_insurance_url TEXT,
  vehicle_registration_url TEXT,
  
  -- Progress tracking
  current_step INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;

-- Users with onboarding role can view and update their own session
CREATE POLICY "Users can view their own onboarding session"
  ON public.onboarding_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding session"
  ON public.onboarding_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding session"
  ON public.onboarding_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all onboarding sessions"
  ON public.onboarding_sessions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE TRIGGER update_onboarding_sessions_updated_at
  BEFORE UPDATE ON public.onboarding_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to complete onboarding and convert to driver
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_driver_id UUID;
BEGIN
  -- Get the onboarding session
  SELECT * INTO v_session
  FROM public.onboarding_sessions
  WHERE id = p_session_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding session not found';
  END IF;
  
  -- Create driver record
  INSERT INTO public.drivers (
    name,
    email,
    contact_phone,
    address,
    license_number,
    emergency_contact_name,
    emergency_contact_phone,
    active,
    onboarded_at,
    onboarded_by
  )
  VALUES (
    v_session.full_name,
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    v_session.contact_phone,
    v_session.address,
    v_session.license_number,
    v_session.emergency_contact_name,
    v_session.emergency_contact_phone,
    true,
    now(),
    auth.uid()
  )
  RETURNING id INTO v_driver_id;
  
  -- Remove onboarding role
  DELETE FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'onboarding';
  
  -- Add driver role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Mark session as completed
  UPDATE public.onboarding_sessions
  SET completed = true, completed_at = now()
  WHERE id = p_session_id;
  
  -- Log the activity
  PERFORM log_activity(
    'onboarding_completed',
    'driver',
    v_driver_id,
    jsonb_build_object('session_id', p_session_id)
  );
END;
$$;