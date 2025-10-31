-- Update the complete_onboarding function to use status instead of completed flag
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
BEGIN
  -- Get the onboarding session
  SELECT * INTO v_session
  FROM public.onboarding_sessions
  WHERE id = p_session_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding session not found';
  END IF;
  
  -- Update session status to submitted
  UPDATE public.onboarding_sessions
  SET 
    status = 'submitted',
    completed = true,
    completed_at = now()
  WHERE id = p_session_id;
  
  -- Log the activity
  PERFORM log_activity(
    'onboarding_submitted',
    'onboarding_session',
    p_session_id,
    jsonb_build_object('session_id', p_session_id, 'full_name', v_session.full_name)
  );
END;
$function$;