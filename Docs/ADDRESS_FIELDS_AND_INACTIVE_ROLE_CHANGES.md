# Address Fields and Inactive Role Implementation

## Summary of Changes

This document outlines the changes made to implement:
1. New address field format (address_line_1, address_line_2, address_line_3, postcode)
2. Inactive role and active/inactive status management for drivers
3. Role display in staff edit form
4. Automatic role management based on driver active status

---

## 1. Database Changes

### Migration: `20251108040000_update_address_fields_and_inactive_role.sql`

#### Address Fields Update
- **Added columns to `profiles` table:**
  - `address_line_1` (TEXT)
  - `address_line_2` (TEXT)
  - `address_line_3` (TEXT)
  - `postcode` (TEXT)
- **Migration:** Existing `address` data is copied to `address_line_1` if it exists
- **View Update:** `role_profiles` view updated to include new address fields
- **Note:** Old `address` column is kept for backward compatibility (can be dropped later)

#### Inactive Role
- **Added `inactive` role to `app_role` enum**
- **Purpose:** Users with this role can only login and message admin

#### Automatic Role Management
- **Function:** `manage_driver_status()`
  - Automatically manages roles based on `drivers.active` status
  - **When driver is set to inactive:**
    - Removes `driver` role
    - Adds `inactive` role
  - **When driver is set to active:**
    - Removes `inactive` role
    - Adds `driver` role
- **Trigger:** `driver_status_role_trigger`
  - Fires on INSERT and UPDATE of `drivers.active`
  - Automatically calls `manage_driver_status()` function

---

## 2. Component Updates

### StaffManagement Component
- **Address Fields:** Updated to use `address_line_1`, `address_line_2`, `address_line_3`, `postcode`
- **Role Display:** Added non-editable role field in edit form
  - Role is fetched from `user_roles` table
  - Displays as disabled input field
  - Note: "Role cannot be changed. Managed through User Roles tab."
- **Form Fields:**
  - Address Line 1
  - Address Line 2
  - Address Line 3
  - Postcode

### DriverManagement Component
- **Address Fields:** Updated to use new address format
- **Active/Inactive Status:**
  - Added checkbox for "Active Driver"
  - When unchecked, driver is marked inactive
  - Automatic role management via database trigger
  - Helper text explains the behavior
- **Form Fields:**
  - All personal information fields (from profiles)
  - All driver-specific fields (license, vehicle)
  - Active status checkbox

### ProfileScreen Component
- **Address Display:** Updated to show new address fields
  - Displays address_line_1, address_line_2, address_line_3, postcode
  - Each line displayed on a separate line
  - Only shows if at least one address field has data

### OnboardingApplications Component
- **Address Fields:** Updated to use new address format when creating driver
  - Maps `address_line_1`, `address_line_2`, `address_line_3` from onboarding session
  - Maps `post_code` to `postcode` in profiles table

### create-staff-account Edge Function
- **Address Fields:** Updated to use new address format
  - Sets `address_line_1`, `address_line_2`, `address_line_3`, `postcode` to null on creation
  - Can be updated later through staff management

---

## 3. Role Management

### Inactive Role Behavior
- **When user has `inactive` role:**
  - Can only login
  - Can only access `/inbox` route
  - Can only message admin
  - Cannot access dashboard, routes, expenses, etc.

### Driver Active/Inactive Status
- **Active Driver (`active = true`):**
  - Has `driver` role
  - Can use system normally
  - Can access dashboard, routes, expenses, etc.
- **Inactive Driver (`active = false`):**
  - Has `inactive` role (automatically assigned)
  - `driver` role is removed (automatically)
  - Can only login and message admin
  - When admin sets driver back to active:
    - `inactive` role is removed (automatically)
    - `driver` role is restored (automatically)

### Automatic Role Management
- **Database Trigger:** `driver_status_role_trigger`
  - Fires on INSERT or UPDATE of `drivers.active`
  - Automatically calls `manage_driver_status()` function
  - No manual role assignment needed when changing active status

---

## 4. Login and Routing

### Login.tsx
- **Updated redirect logic:**
  - Inactive users → `/inbox`
  - Admin → `/admin`
  - Dispatcher → `/dispatcher`
  - HR/Finance → `/hr`
  - Driver → `/dashboard`
  - Onboarding → `/onboarding`

### Inbox.tsx
- **Updated recipient filtering:**
  - Inactive users can only message admin
  - Onboarding users can only message admin
  - Drivers can message admin, HR, finance (not drivers or onboarding)

### send-notification Edge Function
- **Updated to support inactive role:**
  - Inactive users can only message admin
  - Error message: "Inactive users can only message admins."
  - Filters out inactive users from recipient lists for drivers

---

## 5. UserManagement Component

### Role Assignment
- **Updated to support inactive role:**
  - `assign_user_role` RPC function supports `inactive` role
  - `remove_user_role` RPC function supports `inactive` role
  - `get_available_roles` RPC function automatically includes `inactive` role (via enum)

---

## 6. Files Modified

### Database Migrations
- `supabase/migrations/20251108040000_update_address_fields_and_inactive_role.sql` (NEW)

### Components
- `src/components/admin/StaffManagement.tsx`
- `src/components/admin/DriverManagement.tsx`
- `src/components/admin/UserManagement.tsx`
- `src/components/admin/OnboardingApplications.tsx`
- `src/pages/ProfileScreen.tsx`
- `src/pages/Login.tsx`
- `src/pages/Inbox.tsx`

### Edge Functions
- `supabase/functions/create-staff-account/index.ts`
- `supabase/functions/send-notification/index.ts`

---

## 7. Testing Checklist

### Address Fields
- [ ] Staff edit form shows new address fields
- [ ] Driver edit form shows new address fields
- [ ] Profile screen displays new address format
- [ ] Creating staff account works with new address fields
- [ ] Onboarding approval creates driver with new address format
- [ ] All address fields save correctly

### Active/Inactive Status
- [ ] Driver can be set to inactive via checkbox
- [ ] When driver is set to inactive:
  - [ ] Driver role is automatically removed
  - [ ] Inactive role is automatically added
  - [ ] Driver can only login and access inbox
  - [ ] Driver can only message admin
- [ ] When driver is set to active:
  - [ ] Inactive role is automatically removed
  - [ ] Driver role is automatically restored
  - [ ] Driver can access dashboard and all features
- [ ] Admin can assign/remove inactive role manually via User Roles tab

### Role Display
- [ ] Staff edit form shows role as non-editable field
- [ ] Role is dynamically fetched from user_roles table
- [ ] Role updates when changed in User Roles tab

### Login and Routing
- [ ] Inactive users are redirected to `/inbox` after login
- [ ] Inactive users can only access `/inbox` route
- [ ] Inactive users can message admin
- [ ] Active drivers are redirected to `/dashboard` after login
- [ ] Active drivers can access all driver features

---

## 8. Migration Instructions

### Apply Migration
1. **Run the migration:**
   ```sql
   -- Apply via Supabase Dashboard SQL Editor or CLI
   -- File: supabase/migrations/20251108040000_update_address_fields_and_inactive_role.sql
   ```

2. **Verify migration:**
   - Check that `address_line_1`, `address_line_2`, `address_line_3`, `postcode` columns exist in `profiles` table
   - Check that `inactive` role exists in `app_role` enum
   - Check that `manage_driver_status()` function exists
   - Check that `driver_status_role_trigger` trigger exists

3. **Test the changes:**
   - Edit a staff member and verify address fields work
   - Edit a driver and verify address fields and active status work
   - Set a driver to inactive and verify roles are managed automatically
   - Set a driver to active and verify roles are restored

---

## 9. Important Notes

### Address Fields
- **Backward Compatibility:** Old `address` column is kept for now
- **Migration:** Existing address data is copied to `address_line_1`
- **Future:** Old `address` column can be dropped after confirming migration works

### Active/Inactive Status
- **Automatic Role Management:** Roles are managed automatically via database trigger
- **No Manual Intervention:** Admin doesn't need to manually assign/remove roles when changing active status
- **Driver Record Required:** Active/inactive status only applies to users with a `drivers` record

### Inactive Role
- **Purpose:** Restrict access for inactive drivers
- **Access:** Can only login and message admin
- **Assignment:** Can be assigned manually via User Roles tab or automatically when driver is set to inactive

### Role Display
- **Non-Editable:** Role cannot be changed in staff edit form
- **Managed Separately:** Role changes must be made via User Roles tab
- **Dynamic:** Role is fetched from `user_roles` table, so it updates when changed elsewhere

---

## 10. Breaking Changes

### None
- All changes are backward compatible
- Old `address` column is kept for migration period
- Existing functionality remains intact
- New features are additive

---

## 11. Future Improvements

### Potential Enhancements
- Drop old `address` column after migration period
- Add address validation (postcode format, etc.)
- Add address autocomplete for UK addresses
- Add address history/audit trail
- Add bulk address update functionality
- Add address import/export functionality

---

## 12. Support

If you encounter any issues:
1. Check that the migration was applied successfully
2. Verify that all columns exist in the database
3. Check browser console for errors
4. Verify that RLS policies allow the operations
5. Check that triggers are firing correctly

