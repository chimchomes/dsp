# Testing Guide - Before Committing Changes

## Overview
This guide helps you test all the changes before committing them to version control. Test each feature to ensure everything works correctly.

---

## Step 1: Review Changed Files

### Modified Files
- `src/components/HeaderBar.tsx` - Red dot on message icon
- `src/components/admin/OnboardingApplications.tsx` - Address fields update
- `src/components/admin/UserManagement.tsx` - Inactive role support
- `src/pages/AdminDashboard.tsx` - Exit button
- `src/pages/Dashboard.tsx` - Inactive user redirect
- `src/pages/Login.tsx` - Inactive user redirect
- `src/pages/Inbox.tsx` - Inactive user messaging
- `src/pages/ProfileScreen.tsx` - New address format
- `src/pages/DispatcherLogin.tsx` - Password change
- `src/components/PasswordChangePrompt.tsx` - Password validation
- `supabase/functions/send-notification/index.ts` - Inactive user support

### New Files
- `src/components/admin/DriverManagement.tsx` - Driver management with address fields
- `src/components/admin/StaffManagement.tsx` - Staff management with address fields
- `supabase/functions/create-staff-account/index.ts` - Staff account creation
- `supabase/migrations/20251108020000_fix_admin_drivers_policy.sql` - Admin RLS policy
- `supabase/migrations/20251108030000_add_vehicle_fields_to_drivers.sql` - Vehicle fields
- `supabase/migrations/20251108040000_update_address_fields_and_inactive_role.sql` - Address fields & inactive role

---

## Step 2: Test Database Migration (SAFEST FIRST)

### ⚠️ IMPORTANT: Test in a Safe Environment First

**Option A: Test on Local/Dev Database**
1. Apply migration to a test/dev database first
2. Test all functionality
3. If everything works, apply to production

**Option B: Backup Before Testing**
1. Backup your production database
2. Apply migration
3. Test functionality
4. If issues occur, restore from backup

### Migration to Apply
**File:** `supabase/migrations/20251108040000_update_address_fields_and_inactive_role.sql`

**What it does:**
- Adds `address_line_1`, `address_line_2`, `address_line_3`, `postcode` to `profiles` table
- Adds `inactive` role to `app_role` enum
- Creates trigger to automatically manage roles based on driver active status
- Updates `role_profiles` view

**How to Apply:**
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of the migration file
3. Run the SQL
4. Verify no errors

**Verification:**
```sql
-- Check if new columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('address_line_1', 'address_line_2', 'address_line_3', 'postcode');

-- Check if inactive role exists
SELECT unnest(enum_range(NULL::app_role))::text as role;

-- Check if trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'driver_status_role_trigger';
```

---

## Step 3: Test Address Fields

### Test 3.1: Staff Management - Edit Form
1. **Login as Admin**
2. **Navigate to:** Admin Dashboard → Staff tab
3. **Click "Edit" on any staff member**
4. **Verify:**
   - ✅ Role field appears (non-editable, shows current role)
   - ✅ Address fields show: Address Line 1, Address Line 2, Address Line 3, Postcode
   - ✅ All fields are editable (except role and email)
5. **Update address fields:**
   - Enter test data in all address fields
   - Click "Update Profile"
   - Verify success message
6. **Verify data saved:**
   - Re-open edit form
   - Verify address data is saved correctly

### Test 3.2: Driver Management - Edit Form
1. **Navigate to:** Admin Dashboard → Drivers tab
2. **Click "Edit" on any driver**
3. **Verify:**
   - ✅ Address fields show: Address Line 1, Address Line 2, Address Line 3, Postcode
   - ✅ Active Driver checkbox is present
   - ✅ Helper text explains active/inactive behavior
4. **Update address fields:**
   - Enter test data
   - Click "Update Driver Profile"
   - Verify success message
5. **Verify data saved:**
   - Re-open edit form
   - Verify address data is saved correctly

### Test 3.3: Profile Screen (Driver View)
1. **Login as Driver**
2. **Navigate to:** My Profile
3. **Verify:**
   - ✅ Address displays in new format (Line 1, Line 2, Line 3, Postcode)
   - ✅ Each line displays on separate line
   - ✅ Only shows if address data exists

### Test 3.4: Create Staff Account
1. **Navigate to:** Admin Dashboard → Staff tab
2. **Click "Create Staff Account"**
3. **Create a new staff member:**
   - Fill in all required fields
   - Leave address fields empty (or fill them)
   - Click "Create Staff Account"
4. **Verify:**
   - ✅ Staff account is created successfully
   - ✅ Edit the new staff member
   - ✅ Address fields are available for editing

---

## Step 4: Test Active/Inactive Status

### Test 4.1: Set Driver to Inactive
1. **Navigate to:** Admin Dashboard → Drivers tab
2. **Click "Edit" on a driver**
3. **Uncheck "Active Driver" checkbox**
4. **Verify helper text:** "Driver will be marked inactive..."
5. **Click "Update Driver Profile"**
6. **Verify:**
   - ✅ Success message appears
   - ✅ Status column shows "Inactive" badge
   - ✅ Check database: `user_roles` table
     - Driver should NOT have `driver` role
     - Driver SHOULD have `inactive` role

### Test 4.2: Login as Inactive Driver
1. **Logout from admin account**
2. **Login as the inactive driver**
3. **Verify:**
   - ✅ Redirected to `/inbox` (not dashboard)
   - ✅ Can only see Inbox page
   - ✅ Cannot access `/dashboard`, `/routes`, `/expenses`, etc.
   - ✅ If try to access dashboard directly, redirected to inbox

### Test 4.3: Inactive Driver Can Message Admin
1. **As inactive driver, navigate to Inbox**
2. **Click "Compose" tab**
3. **Verify:**
   - ✅ Only "Admin" role is available in recipient dropdown
   - ✅ Can compose and send message to admin
   - ✅ Message is sent successfully

### Test 4.4: Set Driver Back to Active
1. **Login as Admin**
2. **Navigate to:** Admin Dashboard → Drivers tab
3. **Click "Edit" on the inactive driver**
4. **Check "Active Driver" checkbox**
5. **Verify helper text:** "Driver can use the system normally..."
6. **Click "Update Driver Profile"**
7. **Verify:**
   - ✅ Success message appears
   - ✅ Status column shows "Active" badge
   - ✅ Check database: `user_roles` table
     - Driver SHOULD have `driver` role
     - Driver should NOT have `inactive` role

### Test 4.5: Active Driver Can Use System
1. **Logout from admin account**
2. **Login as the now-active driver**
3. **Verify:**
   - ✅ Redirected to `/dashboard` (not inbox)
   - ✅ Can access dashboard, routes, expenses, etc.
   - ✅ Can use system normally

---

## Step 5: Test Role Display in Staff Edit Form

### Test 5.1: Role Field Appears
1. **Navigate to:** Admin Dashboard → Staff tab
2. **Click "Edit" on any staff member**
3. **Verify:**
   - ✅ Role field appears (shows current role, e.g., "Hr", "Admin")
   - ✅ Role field is disabled (non-editable)
   - ✅ Helper text: "Role cannot be changed. Managed through User Roles tab."

### Test 5.2: Role Updates Dynamically
1. **Navigate to:** Admin Dashboard → User Roles tab
2. **Change a staff member's role**
3. **Navigate back to:** Staff tab
4. **Click "Edit" on the same staff member**
5. **Verify:**
   - ✅ Role field shows the updated role
   - ✅ Role is fetched from `user_roles` table dynamically

---

## Step 6: Test Exit Button on Admin Dashboard

### Test 6.1: Exit Button Appears
1. **Login as Admin**
2. **Navigate to:** Admin Dashboard
3. **Verify:**
   - ✅ "Exit" button appears in top-right corner
   - ✅ Button has logout icon

### Test 6.2: Exit Confirmation Dialog
1. **Click "Exit" button**
2. **Verify:**
   - ✅ Confirmation dialog appears
   - ✅ Title: "Confirm Exit"
   - ✅ Message: "Are you sure you want to exit?..."
   - ✅ Buttons: "Cancel" and "Yes, Exit"

### Test 6.3: Cancel Exit
1. **Click "Cancel" in dialog**
2. **Verify:**
   - ✅ Dialog closes
   - ✅ Still on Admin Dashboard
   - ✅ Still logged in

### Test 6.4: Confirm Exit
1. **Click "Exit" button**
2. **Click "Yes, Exit"**
3. **Verify:**
   - ✅ Logged out
   - ✅ Redirected to `/login`
   - ✅ Toast notification: "Logged out - You have been logged out successfully"

---

## Step 7: Test Red Dot on Message Icon

### Test 7.1: Red Dot Appears with Unread Messages
1. **Send a message to yourself (or have someone send you a message)**
2. **Verify:**
   - ✅ Red dot appears above message icon in header
   - ✅ Red dot appears immediately (real-time)

### Test 7.2: Red Dot Disappears When All Messages Read
1. **Navigate to Inbox**
2. **Mark all messages as read**
3. **Verify:**
   - ✅ Red dot disappears from message icon
   - ✅ Disappears immediately (real-time)

### Test 7.3: Red Dot Updates in Real-Time
1. **Have another user send you a message**
2. **Verify:**
   - ✅ Red dot appears without page refresh
   - ✅ Works across all pages (dashboard, routes, etc.)

---

## Step 8: Test Driver Management - Missing Columns Fix

### Test 8.1: Drivers Table Loads
1. **Navigate to:** Admin Dashboard → Drivers tab
2. **Verify:**
   - ✅ No errors in console
   - ✅ Drivers table loads successfully
   - ✅ All columns display: Name, Email, Phone, License, Vehicle, Status, Onboarded, Actions

### Test 8.2: Edit Driver Works
1. **Click "Edit" on any driver**
2. **Verify:**
   - ✅ Edit dialog opens
   - ✅ All fields are populated correctly
   - ✅ No missing columns error
   - ✅ Can update all fields including license_expiry and vehicle fields

### Test 8.3: Save Driver Updates
1. **Update driver information:**
   - Update personal info (name, phone, address)
   - Update driver-specific info (license, vehicle)
   - Change active status
2. **Click "Update Driver Profile"**
3. **Verify:**
   - ✅ No errors
   - ✅ Success message appears
   - ✅ Table refreshes with updated data
   - ✅ All changes are saved correctly

---

## Step 9: Test Referential Integrity (Optional)

### Test 9.1: Driver Role Enforcement
1. **Check database:** Verify that drivers with `active = true` have `driver` role
2. **Check database:** Verify that drivers with `active = false` have `inactive` role
3. **Manually test trigger:**
   - Update a driver's active status in database
   - Verify roles are updated automatically

### Test 9.2: User ID Referential Integrity
1. **Verify:** All drivers have valid `user_id` that exists in `auth.users`
2. **Verify:** All profiles have valid `user_id` that exists in `auth.users`
3. **Verify:** All user_roles have valid `user_id` that exists in `auth.users`

---

## Step 10: Rollback Plan (If Something Goes Wrong)

### If Migration Fails
1. **Check error message** in Supabase Dashboard
2. **Common issues:**
   - Column already exists → Migration is idempotent, should handle this
   - Enum value already exists → Migration checks for this
   - Trigger already exists → Migration drops and recreates

### If Functionality Doesn't Work
1. **Check browser console** for errors
2. **Check Supabase logs** for database errors
3. **Verify migration was applied** correctly
4. **Check RLS policies** are not blocking access

### Rollback Migration (If Needed)
```sql
-- Remove trigger
DROP TRIGGER IF EXISTS driver_status_role_trigger ON public.drivers;

-- Remove function
DROP FUNCTION IF EXISTS public.manage_driver_status();

-- Remove inactive role (if needed - this is harder, may require recreating enum)
-- Note: Removing enum values is complex in PostgreSQL

-- Remove address columns (if needed)
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS address_line_1,
DROP COLUMN IF EXISTS address_line_2,
DROP COLUMN IF EXISTS address_line_3,
DROP COLUMN IF EXISTS postcode;

-- Restore old role_profiles view (if needed)
-- Check previous migration for view definition
```

---

## Step 11: Final Verification Checklist

Before committing, verify:
- [ ] Migration applied successfully
- [ ] No errors in browser console
- [ ] No errors in Supabase logs
- [ ] Address fields work in all forms
- [ ] Role display works in staff edit form
- [ ] Active/inactive status works correctly
- [ ] Inactive users can only access inbox
- [ ] Inactive users can message admin
- [ ] Active drivers can use system normally
- [ ] Exit button works correctly
- [ ] Red dot on message icon works correctly
- [ ] Driver management loads without errors
- [ ] All updates save correctly
- [ ] No breaking changes to existing functionality

---

## Quick Test Script

Run these SQL queries to verify migration:

```sql
-- 1. Check address columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE 'address%' OR column_name = 'postcode'
ORDER BY column_name;

-- 2. Check inactive role exists
SELECT unnest(enum_range(NULL::app_role))::text as role 
ORDER BY role;

-- 3. Check trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'driver_status_role_trigger';

-- 4. Check function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'manage_driver_status';

-- 5. Test trigger (optional - be careful)
-- Update a driver's active status and verify roles change
```

---

## Testing Order Recommendation

1. **First:** Apply migration and verify it works (Step 2)
2. **Second:** Test address fields (Step 3)
3. **Third:** Test role display (Step 5)
4. **Fourth:** Test active/inactive status (Step 4)
5. **Fifth:** Test exit button (Step 6)
6. **Sixth:** Test red dot (Step 7)
7. **Seventh:** Test driver management (Step 8)

This order ensures you test the foundation (migration) first, then build up to more complex features.

---

## If Tests Pass

✅ **All tests passed?** Great! You can commit the changes.

**Files to commit:**
- All modified files
- All new files
- Migration files
- Documentation files

**Git commands:**
```bash
git add .
git commit -m "Add address fields, inactive role, and active/inactive status management"
git push
```

---

## If Tests Fail

❌ **Tests failed?** 
1. Check the error message
2. Review the rollback plan (Step 10)
3. Fix the issue
4. Test again
5. Only commit when all tests pass

---

## Need Help?

If you encounter issues:
1. Check browser console for errors
2. Check Supabase logs for database errors
3. Verify migration was applied correctly
4. Check RLS policies
5. Review the documentation files in `Docs/` folder

