-- Delete driver record and user role for jclarken42qd@gmail.com
-- This will allow you to re-add the driver using the correct HR process

DO $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT := 'jclarken42qd@gmail.com';
  v_driver_id UUID;
BEGIN
  -- Get user_id from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_user_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found in auth.users', v_user_email;
    RETURN;
  END IF;
  
  -- Find driver record
  SELECT id INTO v_driver_id
  FROM drivers
  WHERE user_id = v_user_id OR email = v_user_email
  LIMIT 1;
  
  IF v_driver_id IS NOT NULL THEN
    -- Delete driver record (this will cascade delete related records)
    DELETE FROM drivers WHERE id = v_driver_id;
    RAISE NOTICE 'Deleted driver record (id: %) for user %', v_driver_id, v_user_email;
  ELSE
    RAISE NOTICE 'No driver record found for user %', v_user_email;
  END IF;
  
  -- Remove driver role
  DELETE FROM user_roles
  WHERE user_id = v_user_id AND role = 'driver';
  
  IF FOUND THEN
    RAISE NOTICE 'Removed driver role for user %', v_user_email;
  ELSE
    RAISE NOTICE 'No driver role found for user %', v_user_email;
  END IF;
  
  RAISE NOTICE 'Cleanup complete for user %', v_user_email;
END;
$$;
