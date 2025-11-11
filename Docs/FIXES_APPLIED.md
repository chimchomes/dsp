# Fixes Applied: Profile Data Alignment

## Problem
The `profiles` table was missing the `contact_phone`, `address`, `emergency_contact_name`, and `emergency_contact_phone` columns, causing errors when trying to update user profiles (e.g., "Could not find the 'contact_phone' column of 'profiles' in the schema cache").

## Solution

### 1. Database Migration
Created migration `20251108010000_add_personal_fields_to_profiles.sql` that:
- Adds `contact_phone`, `address`, `emergency_contact_name`, `emergency_contact_phone` columns to `profiles` table
- Updates `role_profiles` view to include these new fields
- Migrates existing data from `drivers` table to `profiles` table
- Migrates existing data from `onboarding_sessions` table to `profiles` table
- Adds RLS policies for UPDATE operations (users can update their own profile, HR/Admin can update any profile)

### 2. Component Updates

#### StaffManagement Component
- Updated to fetch and display all profile fields (contact_phone, address, emergency_contact_name, emergency_contact_phone)
- Enhanced edit profile form to include all personal information fields
- Updated profile update to save all fields to `profiles` table

#### OnboardingApplications Component
- Updated onboarding approval process to:
  - Update `profiles` table with personal info (contact_phone, address, emergency_contact)
  - Create `drivers` record with driver-specific data (license, vehicle)
  - Link driver record to user via `user_id` FK

#### create-staff-account Edge Function
- Updated to include all profile fields when creating staff accounts

### 3. Documentation
Created `DATA_MODEL_REFERENCE.md` that documents:
- What information is stored where (auth.users, profiles, drivers, onboarding_sessions)
- How tables relate to each other (FK relationships)
- Who can edit what data
- How to add new fields in the future

## How to Apply

### Step 1: Run the Migration
```bash
# Apply the migration to add the missing columns
supabase migration up
```

Or if using Supabase CLI locally:
```bash
supabase db reset  # This will apply all migrations
```

Or apply directly via SQL:
```sql
-- Run the contents of supabase/migrations/20251108010000_add_personal_fields_to_profiles.sql
```

### Step 2: Verify the Migration
After running the migration, verify that:
1. The `profiles` table has the new columns:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name IN ('contact_phone', 'address', 'emergency_contact_name', 'emergency_contact_phone');
   ```

2. The `role_profiles` view includes the new fields:
   ```sql
   SELECT * FROM role_profiles LIMIT 1;
   ```

3. RLS policies are in place:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

### Step 3: Test the Fix
1. Go to Admin Dashboard → Staff tab
2. Click "Edit" on any staff member
3. Update their contact phone, address, and emergency contact information
4. Click "Update Profile"
5. Verify the update succeeds (no error about missing `contact_phone` column)

## Data Model Summary

### Profiles Table (ALL Users)
- Stores personal information for ALL users (admin, hr, finance, dispatcher, driver, onboarding)
- Fields: `user_id`, `first_name`, `surname`, `full_name`, `email`, `contact_phone`, `address`, `emergency_contact_name`, `emergency_contact_phone`
- One profile per user (1:1 relationship via `user_id` PK/FK)

### Drivers Table (Drivers Only)
- Stores driver-specific data (license, vehicle)
- Fields: `id`, `user_id` (FK to auth.users), `license_number`, `license_expiry`, `vehicle_make`, `vehicle_model`, `vehicle_year`, `vehicle_registration`, `active`, `onboarded_at`, `onboarded_by`
- One driver record per driver (1:1 relationship via `user_id` UNIQUE constraint)
- **Personal info is in `profiles` table, not `drivers` table**

### Onboarding Sessions Table (Onboarding Users Only)
- Temporary storage during onboarding process
- Data is copied to `profiles` and `drivers` tables when approved

## Key Points

1. **Personal info in `profiles`**: All personal information (name, contact, address, emergency contact) is stored in `profiles` table for ALL users
2. **Driver-specific info in `drivers`**: Driver-specific data (license, vehicle) is stored in `drivers` table
3. **Forms align with database**: All forms that collect data now match the database schema
4. **Referential integrity**: FK constraints ensure data consistency
5. **RLS policies**: Users can edit their own profile; HR/Admin can edit any profile

## Next Steps

1. Run the migration
2. Test profile updates in the Staff Management component
3. Verify onboarding approval updates profiles correctly
4. Consider adding a user self-service profile edit page (currently only HR/Admin can edit profiles via Staff Management)

