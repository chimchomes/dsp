-- Complete user deletion script
-- This will delete the user from all tables in the system
-- Replace 'jclarken42qd@gmail.com' with the email of the user you want to delete

DO $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT := 'jclarken42qd@gmail.com';
  v_deleted_count INTEGER;
BEGIN
  -- Get user_id from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_user_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found in auth.users', v_user_email;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found user: % (user_id: %)', v_user_email, v_user_id;
  
  -- Delete from user_roles
  DELETE FROM user_roles WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % role(s) from user_roles', v_deleted_count;
  
  -- Delete from profiles
  DELETE FROM profiles WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    RAISE NOTICE 'Deleted profile record';
  END IF;
  
  -- Delete driver record if exists (by user_id or email)
  DELETE FROM drivers WHERE user_id = v_user_id OR email = v_user_email;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    RAISE NOTICE 'Deleted % driver record(s)', v_deleted_count;
  END IF;
  
  -- Delete from onboarding_sessions if exists
  DELETE FROM onboarding_sessions WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    RAISE NOTICE 'Deleted % onboarding session(s)', v_deleted_count;
  END IF;
  
  -- Delete from notifications (as sender or recipient)
  DELETE FROM notifications WHERE sender_id = v_user_id OR recipient_id = v_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    RAISE NOTICE 'Deleted % notification(s)', v_deleted_count;
  END IF;
  
  -- Delete from messages (as sender or receiver)
  DELETE FROM messages WHERE sender_id = v_user_id OR receiver_id = v_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    RAISE NOTICE 'Deleted % message(s)', v_deleted_count;
  END IF;
  
  -- Delete from activity_logs
  DELETE FROM activity_logs WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count > 0 THEN
    RAISE NOTICE 'Deleted % activity log(s)', v_deleted_count;
  END IF;
  
  -- NOTE: To delete from auth.users, you need service role access or use Supabase Dashboard
  -- The SQL below will only work if you're using service role key
  -- Otherwise, use the Supabase Dashboard: Authentication > Users > Delete user
  
  -- Uncomment the line below ONLY if you have service role access:
  -- DELETE FROM auth.users WHERE id = v_user_id;
  
  RAISE NOTICE 'User data deleted from all public tables.';
  RAISE NOTICE 'IMPORTANT: To complete deletion, delete user from auth.users via:';
  RAISE NOTICE '  - Supabase Dashboard: Authentication > Users > Find user > Delete';
  RAISE NOTICE '  - OR use Supabase Admin API with service role key';
  RAISE NOTICE '  - OR run: DELETE FROM auth.users WHERE id = ''%''; (service role only)', v_user_id;
  
END;
$$;

-- Alternative: If you just want to see what would be deleted first (dry run):
-- Uncomment and run this first to see what will be deleted:

/*
DO $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT := 'jclarken42qd@gmail.com';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Would delete:';
  RAISE NOTICE '  - User roles: %', (SELECT COUNT(*) FROM user_roles WHERE user_id = v_user_id);
  RAISE NOTICE '  - Profiles: %', (SELECT COUNT(*) FROM profiles WHERE user_id = v_user_id);
  RAISE NOTICE '  - Drivers: %', (SELECT COUNT(*) FROM drivers WHERE user_id = v_user_id OR email = v_user_email);
  RAISE NOTICE '  - Onboarding sessions: %', (SELECT COUNT(*) FROM onboarding_sessions WHERE user_id = v_user_id);
  RAISE NOTICE '  - Notifications: %', (SELECT COUNT(*) FROM notifications WHERE sender_id = v_user_id OR recipient_id = v_user_id);
  RAISE NOTICE '  - Messages: %', (SELECT COUNT(*) FROM messages WHERE sender_id = v_user_id OR receiver_id = v_user_id);
  RAISE NOTICE '  - Activity logs: %', (SELECT COUNT(*) FROM activity_logs WHERE user_id = v_user_id);
END;
$$;
*/
