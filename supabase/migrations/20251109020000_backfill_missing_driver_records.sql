-- Backfill missing driver records for users who have driver role but no driver record
-- This fixes the issue where users were assigned driver role but driver record creation failed

-- Create a function to backfill driver records from onboarding sessions
CREATE OR REPLACE FUNCTION backfill_missing_driver_records()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  name TEXT,
  driver_record_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_session RECORD;
  v_driver_id UUID;
  v_admin_id UUID;
  v_name TEXT;
  v_first_name TEXT;
  v_surname TEXT;
BEGIN
  -- Get an admin user_id for onboarded_by (use first admin found)
  SELECT ur.user_id INTO v_admin_id
  FROM user_roles ur
  WHERE ur.role = 'admin'
  LIMIT 1;

  -- Find users with driver role but no driver record
  FOR v_user IN
    SELECT DISTINCT ur.user_id, p.email, p.full_name, p.first_name, p.surname
    FROM user_roles ur
    LEFT JOIN profiles p ON p.user_id = ur.user_id
    WHERE ur.role = 'driver'
      AND NOT EXISTS (
        SELECT 1 FROM drivers d WHERE d.user_id = ur.user_id
      )
  LOOP
    -- Try to find onboarding session data for this user
    SELECT 
      os.full_name,
      os.first_name,
      os.surname,
      os.email,
      os.contact_phone,
      os.license_number,
      os.license_expiry,
      os.vehicle_make,
      os.vehicle_model,
      os.vehicle_year,
      os.vehicle_registration,
      os.address_line_1,
      os.address_line_2,
      os.address_line_3,
      os.post_code,
      os.emergency_contact_name,
      os.emergency_contact_phone,
      os.reviewed_at,
      os.created_at
    INTO v_session
    FROM onboarding_sessions os
    WHERE os.user_id = v_user.user_id
      AND os.status = 'accepted'
    ORDER BY os.reviewed_at DESC NULLS LAST, os.created_at DESC
    LIMIT 1;

    -- Determine name to use
    v_name := COALESCE(
        v_user.full_name,
        v_session.full_name,
        (CASE 
          WHEN v_user.first_name IS NOT NULL AND v_user.surname IS NOT NULL 
          THEN v_user.first_name || ' ' || v_user.surname
          ELSE NULL
        END),
        (CASE 
          WHEN v_session.first_name IS NOT NULL AND v_session.surname IS NOT NULL 
          THEN v_session.first_name || ' ' || v_session.surname
          ELSE NULL
        END),
        v_user.email
      );

      v_first_name := COALESCE(v_user.first_name, v_session.first_name);
      v_surname := COALESCE(v_user.surname, v_session.surname);

      -- Create driver record
      INSERT INTO drivers (
        user_id,
        email,
        name,
        license_number,
        license_expiry,
        vehicle_make,
        vehicle_model,
        vehicle_year,
        vehicle_registration,
        onboarded_at,
        onboarded_by,
        active
      )
      VALUES (
        v_user.user_id,
        COALESCE(v_user.email, v_session.email),
        v_name,
        v_session.license_number,
        CASE 
          WHEN v_session.license_expiry IS NOT NULL 
          THEN v_session.license_expiry::date
          ELSE NULL
        END,
        v_session.vehicle_make,
        v_session.vehicle_model,
        v_session.vehicle_year,
        v_session.vehicle_registration,
        COALESCE(
          v_session.reviewed_at,
          v_session.created_at,
          NOW()
        ),
        v_admin_id,
        true
      )
      RETURNING id INTO v_driver_id;

      -- Update profile if we have onboarding session data
      IF v_session IS NOT NULL THEN
        UPDATE profiles
        SET
          first_name = COALESCE(profiles.first_name, v_session.first_name),
          surname = COALESCE(profiles.surname, v_session.surname),
          full_name = COALESCE(profiles.full_name, v_session.full_name, v_name),
          contact_phone = COALESCE(profiles.contact_phone, v_session.contact_phone),
          address_line_1 = COALESCE(profiles.address_line_1, v_session.address_line_1),
          address_line_2 = COALESCE(profiles.address_line_2, v_session.address_line_2),
          address_line_3 = COALESCE(profiles.address_line_3, v_session.address_line_3),
          postcode = COALESCE(profiles.postcode, v_session.post_code),
          emergency_contact_name = COALESCE(profiles.emergency_contact_name, v_session.emergency_contact_name),
          emergency_contact_phone = COALESCE(profiles.emergency_contact_phone, v_session.emergency_contact_phone),
          updated_at = NOW()
        WHERE user_id = v_user.user_id;
      END IF;

      -- Return result
      RETURN QUERY SELECT 
        v_user.user_id,
        COALESCE(v_user.email, v_session.email)::TEXT,
        v_name,
        true;
  END LOOP;

  RETURN;
END;
$$;

-- Run the backfill function
-- This will create driver records for all users with driver role but no driver record
DO $$
DECLARE
  v_result RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_result IN SELECT * FROM backfill_missing_driver_records() LOOP
    v_count := v_count + 1;
    RAISE NOTICE 'Created driver record for user: % (%), name: %', v_result.user_id, v_result.email, v_result.name;
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE 'No missing driver records found. All users with driver role already have driver records.';
  ELSE
    RAISE NOTICE 'Backfill complete. Created % driver record(s).', v_count;
  END IF;
END;
$$;

-- Drop the function after use (optional - you can keep it for future use)
-- DROP FUNCTION IF EXISTS backfill_missing_driver_records();

