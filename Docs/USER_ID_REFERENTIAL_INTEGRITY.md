# User ID and Referential Integrity

## Overview

The `user_id` from `auth.users` is the **critical link** that maintains referential integrity across your entire system. This document explains how it works and why it's important.

## The Critical Link: `user_id`

### `auth.users.id` → `profiles.user_id`

```
auth.users (id: UUID) 
    ↓ (FK constraint)
profiles (user_id: UUID, PK, FK → auth.users.id)
    ↓ (used everywhere)
user_roles (user_id: UUID, FK → auth.users.id)
drivers (user_id: UUID, FK → auth.users.id)
onboarding_sessions (user_id: UUID, FK → auth.users.id)
routes (driver_id → drivers.id → drivers.user_id → auth.users.id)
expenses (driver_id → drivers.id → drivers.user_id → auth.users.id)
incidents (driver_id → drivers.id → drivers.user_id → auth.users.id)
notifications (sender_id, recipient_id → auth.users.id)
messages (sender_id, receiver_id → auth.users.id)
```

## How Referential Integrity is Enforced

### 1. Foreign Key Constraints

**Profiles Table**:
```sql
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
```

**What this means**:
- ✅ Every `profiles.user_id` MUST exist in `auth.users.id`
- ✅ If you try to insert a profile with a `user_id` that doesn't exist in `auth.users`, it will fail
- ✅ If you delete a user from `auth.users`, their profile is automatically deleted (CASCADE)

**Drivers Table**:
```sql
ALTER TABLE public.drivers 
  ADD CONSTRAINT drivers_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

ALTER TABLE public.drivers 
  ADD CONSTRAINT drivers_user_id_unique 
  UNIQUE (user_id);
```

**What this means**:
- ✅ Every `drivers.user_id` MUST exist in `auth.users.id`
- ✅ One driver record per user (UNIQUE constraint)
- ✅ If you delete a user from `auth.users`, their driver record is automatically deleted (CASCADE)

**User Roles Table**:
```sql
ALTER TABLE public.user_roles 
  ADD CONSTRAINT user_roles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
```

**What this means**:
- ✅ Every `user_roles.user_id` MUST exist in `auth.users.id`
- ✅ If you delete a user from `auth.users`, their roles are automatically deleted (CASCADE)

## What Happens When You Update a Name

### Scenario: User updates their name from "John Doe" to "Jane Smith"

**Step 1**: User updates profile
```typescript
await supabase
  .from("profiles")
  .update({
    first_name: "Jane",
    surname: "Smith",
    full_name: "Jane Smith"
  })
  .eq("user_id", userId);
```

**Result**:
- ✅ `profiles.first_name` = "Jane" ✅
- ✅ `profiles.surname` = "Smith" ✅
- ✅ `profiles.full_name` = "Jane Smith" ✅
- ✅ `profiles.user_id` = `auth.users.id` (unchanged, still the link) ✅
- ❌ `auth.users.user_metadata.first_name` = "John" (unchanged, stale) ❌
- ❌ `auth.users.user_metadata.surname` = "Doe" (unchanged, stale) ❌

**Why this is fine**:
- ✅ `user_id` remains the same (the critical link is preserved)
- ✅ App displays "Jane Smith" (from `profiles` table)
- ✅ All queries use `user_id` to link data (referential integrity maintained)
- ⚠️ `auth.users.user_metadata` may be stale (but we don't use it for display)

## What Matters from `auth.users`

### Critical Fields (Must Have):

1. **`id`** (UUID)
   - ✅ Primary key
   - ✅ Used as `user_id` everywhere
   - ✅ Enforces referential integrity via FK constraints
   - ✅ Cannot be changed
   - ✅ Must exist for any user record

2. **`email`** (TEXT)
   - ✅ Used for authentication (login)
   - ✅ Must be unique
   - ✅ Can be changed via Admin API (but requires careful handling)

3. **Authentication fields**
   - ✅ Password hash (for login)
   - ✅ Session tokens
   - ✅ Email verification status
   - ✅ Last sign-in timestamps

### Not Critical (Can Be Stale):

1. **`user_metadata`** (JSONB)
   - ⚠️ Set during account creation
   - ⚠️ May become stale when profiles are updated
   - ⚠️ Not used for display (we use `profiles` table instead)
   - ✅ Can be updated via Admin API if needed, but not necessary

## Referential Integrity in Action

### Example: Linking Driver Activity to User

```sql
-- Get all routes for a user
SELECT r.*
FROM routes r
JOIN drivers d ON d.id = r.driver_id
WHERE d.user_id = 'user-uuid-from-auth-users';

-- Get all expenses for a user
SELECT e.*
FROM expenses e
JOIN drivers d ON d.id = e.driver_id
WHERE d.user_id = 'user-uuid-from-auth-users';

-- Get user's profile
SELECT p.*
FROM profiles p
WHERE p.user_id = 'user-uuid-from-auth-users';

-- Get user's roles
SELECT ur.role
FROM user_roles ur
WHERE ur.user_id = 'user-uuid-from-auth-users';
```

**All queries use `user_id` from `auth.users.id`** ✅

### Example: Cascading Deletes

```sql
-- Delete user from auth.users
DELETE FROM auth.users WHERE id = 'user-uuid';

-- What happens automatically (due to CASCADE):
-- ✅ profiles record deleted (CASCADE)
-- ✅ user_roles records deleted (CASCADE)
-- ✅ drivers record deleted (CASCADE)
-- ✅ routes deleted (CASCADE via drivers)
-- ✅ expenses deleted (CASCADE via drivers)
-- ✅ incidents deleted (CASCADE via drivers)
-- ✅ notifications deleted (CASCADE)
-- ✅ messages deleted (CASCADE)
```

**Referential integrity is maintained** ✅

## Key Principles

### 1. `user_id` is Immutable
- ✅ `auth.users.id` never changes
- ✅ `profiles.user_id` references `auth.users.id` (cannot change)
- ✅ All other tables reference `user_id` (cannot change)
- ✅ This ensures data integrity across the entire system

### 2. `profiles` is the Source of Truth for Display
- ✅ Use `profiles.first_name`, `profiles.surname`, `profiles.full_name` for display
- ✅ Don't rely on `auth.users.user_metadata` for display (it may be stale)
- ✅ Update `profiles` when users change their information

### 3. `auth.users` is the Source of Truth for Identity
- ✅ `auth.users.id` is the unique identifier
- ✅ `auth.users.email` is used for authentication
- ✅ `auth.users` manages authentication (password, sessions, etc.)

### 4. FK Constraints Enforce Integrity
- ✅ Cannot create a profile without a valid `user_id` in `auth.users`
- ✅ Cannot create a driver record without a valid `user_id` in `auth.users`
- ✅ Deleting a user automatically cleans up all related records (CASCADE)

## Summary

| Aspect | Source of Truth | Can Change? | Used For |
|--------|----------------|-------------|----------|
| **User ID** | `auth.users.id` | ❌ No (immutable) | Referential integrity, linking all data |
| **Email** | `auth.users.email` | ✅ Yes (via Admin API) | Authentication, login |
| **Name** | `profiles.first_name`, `profiles.surname` | ✅ Yes (via profiles update) | Display in app |
| **Contact Info** | `profiles.contact_phone`, `profiles.address` | ✅ Yes (via profiles update) | Display in app |
| **Roles** | `user_roles.role` | ✅ Yes (via user_roles update) | Access control |
| **Driver Data** | `drivers.*` | ✅ Yes (via drivers update) | Driver-specific info |

## Best Practices

1. ✅ **Always use `user_id` from `auth.users.id`** when linking data
2. ✅ **Update `profiles` table** when users change their information
3. ✅ **Don't worry about stale `auth.users.user_metadata`** (it's not used for display)
4. ✅ **Rely on FK constraints** to maintain referential integrity
5. ✅ **Use `profiles` table** as the source of truth for user display information
6. ✅ **Use `auth.users.id`** as the source of truth for user identity

## Conclusion

**The `user_id` from `auth.users` is the critical link that maintains referential integrity across your entire system.** 

- ✅ It's immutable (never changes)
- ✅ It's enforced via FK constraints
- ✅ It ensures data consistency
- ✅ It enables cascading deletes
- ✅ It links all user-related data together

**Personal information (names, contact info) lives in `profiles` and can be updated freely. The `user_id` link remains constant, ensuring referential integrity is always maintained.**

