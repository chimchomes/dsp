# Testing Instructions for Onboarding Forms

## Quick Test (Without Migration)
You can test the UI without running the migration, but **saving will fail** because the database columns don't exist yet.

1. Start dev server: `npm run dev`
2. Navigate to `/onboarding` or `/create-account`
3. Test the form UI and navigation between pages
4. Note: Saving progress will show an error until migration is run

## Full Test (With Migration)

### Step 1: Run the Migration

**Option A: Via Supabase Dashboard (Easiest)**
1. Go to your Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/20251101120000_add_onboarding_fields.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click "Run" or press Ctrl+Enter
6. You should see "Success" message

**Option B: Via Supabase CLI (If installed)**
```bash
# If you have Supabase CLI linked to your project
supabase db push

# Or if you're using local development
supabase migration up
```

### Step 2: Test the Forms

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Test Account Creation:**
   - Navigate to `/create-account`
   - Fill in name and email
   - Submit (check your email for verification link if enabled)

3. **Test Login:**
   - Navigate to `/onboarding-login`
   - Log in with your test account

4. **Test Own Vehicle Form:**
   - Go to `/onboarding`
   - Select "Own Vehicle"
   - Test all 6 pages:
     - Page 1: Personal Details
     - Page 2: Driver's License
     - Page 3: Right to Work
     - Page 4: Vehicle Details
     - Page 5: Identity
     - Page 6: Work Availability
   - Test "Save Progress" button
   - Test navigation (Previous/Next)
   - Test form submission

5. **Test Leased Vehicle Form:**
   - Go to `/onboarding`
   - Select "Leased Vehicle"
   - Test all 6 pages (similar to above)

### Step 3: Verify Data is Saved

1. Check Supabase Dashboard → Table Editor → `onboarding_sessions`
2. Verify all new columns are present
3. Verify data is being saved correctly

## What to Test

- ✅ Form navigation (Previous/Next buttons)
- ✅ Save Progress functionality
- ✅ Required field validation
- ✅ Character limits (maxLength attributes)
- ✅ File uploads (license picture, passport, photo)
- ✅ Dropdown selections (vehicle type, availability)
- ✅ Date pickers (license expiry, passport expiry)
- ✅ Form submission on final page
- ✅ Error handling (try submitting with missing required fields)

## Troubleshooting

**Error: "column does not exist"**
- You haven't run the migration yet. Run it via Supabase Dashboard SQL Editor.

**Error: "rate limit exceeded"**
- The edge function has rate limiting. Wait a few minutes or check the function logs.

**File upload fails**
- Check that the `driver-documents` storage bucket exists and has proper RLS policies.

**Can't log in**
- Check that email verification is configured correctly in Supabase Auth settings.

## Rollback (If Needed)

If you want to remove the new columns:
```sql
-- ⚠️ WARNING: This will delete data in these columns
ALTER TABLE public.onboarding_sessions
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS surname,
DROP COLUMN IF EXISTS address_line_1,
DROP COLUMN IF EXISTS address_line_2,
DROP COLUMN IF EXISTS address_line_3,
DROP COLUMN IF EXISTS post_code,
DROP COLUMN IF EXISTS drivers_license_number,
DROP COLUMN IF EXISTS license_expiry_date,
DROP COLUMN IF EXISTS license_picture,
DROP COLUMN IF EXISTS national_insurance_number,
DROP COLUMN IF EXISTS passport_upload,
DROP COLUMN IF EXISTS passport_number,
DROP COLUMN IF EXISTS passport_expiry_date,
DROP COLUMN IF EXISTS vehicle_registration_number,
DROP COLUMN IF EXISTS vehicle_type,
DROP COLUMN IF EXISTS vehicle_mileage,
DROP COLUMN IF EXISTS leased_vehicle_type1,
DROP COLUMN IF EXISTS leased_vehicle_type2,
DROP COLUMN IF EXISTS leased_vehicle_type3,
DROP COLUMN IF EXISTS photo_upload,
DROP COLUMN IF EXISTS dvla_code,
DROP COLUMN IF EXISTS dbs_check,
DROP COLUMN IF EXISTS driver_availability;
```

