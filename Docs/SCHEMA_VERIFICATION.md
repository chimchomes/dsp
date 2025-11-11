# Schema Verification Document

This document verifies that all columns referenced in the code actually exist in the database schema.

## Drivers Table

### Columns in Schema (from migrations):
1. `id` (UUID, PRIMARY KEY) - ✅ Exists
2. `name` (TEXT) - ✅ Exists
3. `email` (TEXT, UNIQUE) - ✅ Exists
4. `active` (BOOLEAN, DEFAULT true) - ✅ Exists
5. `created_at` (TIMESTAMPTZ, DEFAULT now()) - ✅ Exists
6. `user_id` (UUID) - ✅ Exists (added in 20251107032348)
7. `license_number` (TEXT) - ✅ Exists (added in 20251004131959)
8. `contact_phone` (TEXT) - ✅ Exists (added in 20251004131959) - NOTE: This is deprecated, should use profiles.contact_phone
9. `address` (TEXT) - ✅ Exists (added in 20251004131959) - NOTE: This is deprecated, should use profiles.address_line_1, etc.
10. `emergency_contact_name` (TEXT) - ✅ Exists (added in 20251004131959) - NOTE: This is deprecated, should use profiles.emergency_contact_name
11. `emergency_contact_phone` (TEXT) - ✅ Exists (added in 20251004131959) - NOTE: This is deprecated, should use profiles.emergency_contact_phone
12. `onboarded_at` (TIMESTAMPTZ) - ✅ Exists (added in 20251004131959)
13. `onboarded_by` (UUID) - ✅ Exists (added in 20251004131959)
14. `license_expiry` (DATE) - ✅ Exists (added in 20251108030000)
15. `vehicle_make` (TEXT) - ✅ Exists (added in 20251108030000)
16. `vehicle_model` (TEXT) - ✅ Exists (added in 20251108030000)
17. `vehicle_year` (INTEGER) - ✅ Exists (added in 20251108030000)
18. `vehicle_registration` (TEXT) - ✅ Exists (added in 20251108030000)
19. `updated_at` (TIMESTAMPTZ) - ✅ **ADDED in migration 20251108050000** (was missing, now fixed)

### Columns Referenced in Code:
- `DriverManagement.tsx` selects: `id, user_id, email, license_number, license_expiry, vehicle_make, vehicle_model, vehicle_year, vehicle_registration, active, onboarded_at` - ✅ All exist
- `DriverManagement.tsx` updates: `license_number, license_expiry, vehicle_make, vehicle_model, vehicle_year, vehicle_registration, active, updated_at` - ✅ All exist (after migration 20251108050000)

## Profiles Table

### Columns in Schema (from migrations):
1. `user_id` (UUID, PRIMARY KEY) - ✅ Exists
2. `first_name` (TEXT) - ✅ Exists
3. `surname` (TEXT) - ✅ Exists
4. `full_name` (TEXT) - ✅ Exists
5. `email` (TEXT) - ✅ Exists
6. `created_at` (TIMESTAMPTZ, DEFAULT now()) - ✅ Exists
7. `updated_at` (TIMESTAMPTZ, DEFAULT now()) - ✅ Exists
8. `contact_phone` (TEXT) - ✅ Exists (added in 20251108010000)
9. `address` (TEXT) - ✅ Exists (added in 20251108010000) - NOTE: Deprecated, replaced by address_line_1, address_line_2, address_line_3, postcode
10. `emergency_contact_name` (TEXT) - ✅ Exists (added in 20251108010000)
11. `emergency_contact_phone` (TEXT) - ✅ Exists (added in 20251108010000)
12. `address_line_1` (TEXT) - ✅ Exists (added in 20251108040000)
13. `address_line_2` (TEXT) - ✅ Exists (added in 20251108040000)
14. `address_line_3` (TEXT) - ✅ Exists (added in 20251108040000)
15. `postcode` (TEXT) - ✅ Exists (added in 20251108040000)

### Columns Referenced in Code:
- `DriverManagement.tsx` selects: `user_id, first_name, surname, full_name, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone` - ✅ All exist
- `DriverManagement.tsx` updates: `first_name, surname, full_name, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone, updated_at` - ✅ All exist
- `StaffManagement.tsx` selects: `user_id, first_name, surname, full_name, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone` - ✅ All exist
- `StaffManagement.tsx` updates: `first_name, surname, full_name, contact_phone, address_line_1, address_line_2, address_line_3, postcode, emergency_contact_name, emergency_contact_phone, updated_at` - ✅ All exist

## Summary of Fixes Applied

### Migration 20251108050000_add_updated_at_to_drivers.sql
- **Issue**: `drivers.updated_at` column was referenced in code but did not exist in schema
- **Fix**: Added `updated_at` column to `drivers` table with automatic trigger to update on record changes
- **Status**: ✅ Fixed

## Notes

1. **Deprecated Columns**: The `drivers` table still has `contact_phone`, `address`, `emergency_contact_name`, and `emergency_contact_phone` columns from an older migration (20251004131959). These are deprecated in favor of storing this data in the `profiles` table. The code correctly uses `profiles` table for personal information.

2. **Trigger for updated_at**: The `drivers.updated_at` column now has an automatic trigger that sets it to `now()` on UPDATE. The code also manually sets this value, which is redundant but harmless (the manual value will override the trigger value). For consistency, consider removing the manual setting and letting the trigger handle it automatically.

3. **Address Fields Migration**: The old `address` (TEXT) column in `profiles` has been replaced with `address_line_1`, `address_line_2`, `address_line_3`, and `postcode` fields. The migration (20251108040000) handles the data migration from the old column to the new fields.

## Verification Status

✅ **All columns referenced in code now exist in the database schema.**

## Next Steps

1. Apply migration `20251108050000_add_updated_at_to_drivers.sql` to add the missing `updated_at` column
2. (Optional) Remove manual `updated_at` setting from code and let the trigger handle it automatically
3. (Future) Consider removing deprecated columns from `drivers` table (`contact_phone`, `address`, `emergency_contact_name`, `emergency_contact_phone`) after ensuring all data has been migrated to `profiles` table

