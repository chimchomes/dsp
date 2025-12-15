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

## Recent Fixes (November 2025)

### Staff Management Enhancements

**Deactivation/Reactivation System**:
- Added ability to deactivate staff members
- Deactivation adds "inactive" role (keeps original roles for reactivation)
- Inactive staff hidden from all selectable lists
- Inactive staff visible in Staff Management tab with status badge
- Reactivation restores original roles
- Work history preserved

**Filtering & Search**:
- Added search by name/email
- Added filter by role
- Added filter by status (Active/Inactive)
- Combined filtering support
- Clear search functionality

### Onboarding Workflow Fixes

**Status-Based Editing**:
- Implemented editing restrictions based on status
- Users can only edit when status allows (in_progress, re-submit, rejected)
- Read-only mode for submitted/accepted applications
- Status banners for user feedback

**Re-submit Status**:
- Added "re-submit" status to onboarding_sessions
- Admin can request resubmission
- Users can edit and resubmit when status is re-submit
- Proper status badge display

### Login & Authentication Fixes

**Role-Based Redirects**:
- Fixed finance users redirecting to `/finance` (not `/hr`)
- Separated finance and HR redirects
- Improved error handling
- Added fallback logic for failed role queries

**AuthGuard Improvements**:
- Added fallback to `role_profiles` view if `user_roles` query fails
- Better error handling and logging
- Prevents login failures due to temporary database issues

### Driver Record Creation Fixes

**On Approval**:
- Fixed driver record creation on onboarding approval
- Added comprehensive error logging
- Prevents duplicate driver records
- Proper profile updates
- Role assignment working correctly

**Backfill Migration**:
- Created migration to backfill missing driver records
- Uses onboarding session data
- Updates profiles with onboarding information
- Handles users with driver role but no driver record

## Recent Updates (December 2025)

### Dispatcher Management Improvements

**Form Split into Two Pages**:
- Split dispatcher form into "Basic Information" and "Rates & Settings" tabs
- Better UX - no more scrolling to see all fields
- Basic Information: Company Name, DSP Legal Name, Contact Email, Contact Phone
- Rates & Settings: DSP Parcel Rate, Driver Parcel Rate, Default Deduction Rate, Tour ID Prefix, Legacy fields

**DSP Parcel Rate Field**:
- Added `dsp_parcel_rate` column to dispatchers table
- Separate from `driver_parcel_rate` (revenue vs payout)
- Migration: `20251201000012_add_dsp_parcel_rate.sql`

### Messaging System Enhancements

**Messaging Rules Enforcement**:
- Implemented comprehensive messaging rules for all roles
- Rules enforced in both frontend (UI filtering) and backend (server validation)
- Updated `send-notification` edge function with role-based filtering

**Messaging Rules Matrix**:
- **Admin**: Can message all roles (including users with no roles)
- **Route-Admin**: Can message all except onboarding and inactive
- **Driver**: Can message admin, route-admin, finance, HR (not other drivers, onboarding, inactive)
- **Finance**: Can message all except onboarding and inactive
- **HR**: Can message all except onboarding and inactive
- **Onboarding**: Can only message admin
- **Inactive**: Can only message admin
- **Universal**: No one can message themselves

**Sender Name Display Fix**:
- Fixed inbox to show sender's first name + surname instead of UUID
- Uses `role_profiles` view first (more reliable), falls back to `profiles` table
- Proper name formatting with fallback to email if name not available

**Authorization Header Fix**:
- Improved error handling for missing authorization headers
- Better logging to debug authentication issues
- Case-insensitive header checking

### Route Management Updates

**Driver Route Filtering**:
- Added filter section to DriversPanel component
- Can filter by driver and date
- Shows all routes (past and present) for selected driver
- Displays total routes, active routes, and completed routes counts

**Route Assignment Improvements**:
- Route assignment form: Select dispatcher → Select route → Select driver
- Excludes completed routes from assignment
- Better error handling and validation

**Route Filters**:
- Added date and status filters to imported routes table
- Filter by dispatcher and driver
- Shows route completion details

### Database Migrations

**New Migrations Applied**:
- `20251201000012_add_dsp_parcel_rate.sql` - Adds DSP parcel rate field
- `20251201000013_fix_dispatchers_rls_for_route_admin.sql` - Allows route-admins to manage dispatchers

**Updated Policies**:
- Route-admins can now create, update, and delete dispatchers
- Uses direct EXISTS queries to avoid recursion issues
- Backward compatibility with legacy dispatcher role

## Next Steps

1. Run all migrations (see migration order in DEPLOYMENT.md)
2. Test staff deactivation/reactivation
3. Test onboarding re-submit workflow
4. Verify all role logins work correctly
5. Run backfill migration for existing drivers
6. Test messaging between all role combinations
7. Verify dispatcher form works with new two-page layout

