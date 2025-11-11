# Understanding auth.users vs profiles Table

## Overview

Your system uses **two separate tables** to store user information:

1. **`auth.users`** - Managed by Supabase Auth (authentication system)
2. **`profiles`** - Your custom table in the `public` schema (application data)

## Key Differences

### `auth.users` (Supabase Auth - Read-Only via SQL)

**Purpose**: Core authentication and account management

**Managed by**: Supabase Auth system

**Fields**:
- `id` (UUID, PK) - User ID (used everywhere as `user_id`)
- `email` (TEXT, UNIQUE) - Email address
- `user_metadata` (JSONB) - Metadata stored during account creation:
  - `first_name`
  - `surname`
  - `full_name`
  - `requires_password_change`
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `email_confirmed_at` (TIMESTAMPTZ)
- `last_sign_in_at` (TIMESTAMPTZ)
- And other auth-related fields...

**Key Points**:
- ✅ **Cannot be directly modified via SQL** (use Supabase Admin API)
- ✅ **All user references** in other tables use `auth.users.id`
- ✅ **Created automatically** when you call `supabase.auth.admin.createUser()`
- ✅ **Appears in Supabase Dashboard** → Authentication → Users

### `profiles` (Your Application Table)

**Purpose**: Store personal information for ALL users (admin, hr, finance, dispatcher, driver, onboarding)

**Managed by**: Your application code

**Fields**:
- `user_id` (UUID, PK, FK → auth.users.id) - Links to auth.users
- `first_name` (TEXT)
- `surname` (TEXT)
- `full_name` (TEXT)
- `email` (TEXT) - Denormalized from auth.users for convenience
- `contact_phone` (TEXT)
- `address` (TEXT)
- `emergency_contact_name` (TEXT)
- `emergency_contact_phone` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Key Points**:
- ✅ **Can be updated directly** via SQL or Supabase client
- ✅ **One profile per user** (1:1 relationship via `user_id`)
- ✅ **Updated by your application** when users edit their profile
- ✅ **Does NOT appear in Authentication → Users** (it's in your database tables)

## How They Work Together

### When You Create a New User (Staff Account)

**Step 1**: Create `auth.users` entry
```typescript
// In create-staff-account edge function
const { data: created } = await supabaseAdmin.auth.admin.createUser({
  email: "user@example.com",
  password: "password123",
  user_metadata: {
    first_name: "John",
    surname: "Doe",
    full_name: "John Doe",
    requires_password_change: true,
  },
});
// ✅ This creates an entry in auth.users
// ✅ This entry appears in Supabase Dashboard → Authentication → Users
```

**Step 2**: Create `profiles` entry
```typescript
await supabaseAdmin.from("profiles").upsert({
  user_id: created.user.id, // Link to auth.users
  first_name: "John",
  surname: "Doe",
  full_name: "John Doe",
  email: "user@example.com",
  contact_phone: "1234567890",
  // ... other fields
});
// ✅ This creates an entry in profiles table
// ✅ This does NOT appear in Authentication → Users
```

**Result**:
- ✅ User appears in **Authentication → Users** (from `auth.users`)
- ✅ User profile exists in **Database → profiles** table
- ✅ Both are linked via `user_id`

### When You Update a Profile

**What Happens**:
```typescript
// Update profiles table
await supabase
  .from("profiles")
  .update({
    first_name: "Jane",
    surname: "Smith",
    contact_phone: "9876543210",
  })
  .eq("user_id", userId);
```

**Result**:
- ✅ `profiles` table is updated ✅
- ❌ `auth.users` table is **NOT** updated ❌
- ❌ `user_metadata` in `auth.users` is **NOT** updated ❌

**Why?**
- `profiles` is your application table - you control it
- `auth.users` is managed by Supabase Auth - you can't directly modify it via SQL
- The `user_metadata` in `auth.users` is set during account creation and is not automatically synced

### When You View in Supabase Dashboard

**Authentication → Users**:
- Shows entries from `auth.users` table
- Shows: email, user_metadata (first_name, surname, full_name), created_at, last_sign_in_at, etc.
- ✅ **New users created via `create-staff-account` WILL appear here**

**Database → profiles**:
- Shows entries from `profiles` table
- Shows: user_id, first_name, surname, full_name, email, contact_phone, address, etc.
- ✅ **Profile updates WILL appear here**
- ❌ **Does NOT appear in Authentication → Users**

## Important Notes

### 1. Email Cannot Be Changed
- Email is stored in `auth.users.email` (read-only via SQL)
- Email in `profiles.email` is denormalized (for convenience, but not the source of truth)
- To change email, you must use Supabase Admin API:
  ```typescript
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: "newemail@example.com"
  });
  ```

### 2. Name Updates
- When you update `profiles.first_name` and `profiles.surname`, it updates the `profiles` table
- It does **NOT** automatically update `auth.users.user_metadata.first_name` or `auth.users.user_metadata.surname`
- If you want to sync them, you need to update both:
  ```typescript
  // Update profiles
  await supabase.from("profiles").update({ first_name: "Jane" }).eq("user_id", userId);
  
  // Update auth.users user_metadata (requires Admin API)
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { first_name: "Jane" }
  });
  ```

### 3. New Users Created
- ✅ When you create a new user via `create-staff-account`:
  - Entry is created in `auth.users` ✅
  - Entry is created in `profiles` ✅
  - User appears in **Authentication → Users** ✅
  - Profile appears in **Database → profiles** ✅

### 4. Profile Updates
- ✅ When you update a profile:
  - `profiles` table is updated ✅
  - `auth.users` table is **NOT** updated ❌
  - User still appears in **Authentication → Users** (but with old metadata) ⚠️

## Summary

| Action | auth.users | profiles | Appears in Auth → Users? |
|--------|-----------|----------|-------------------------|
| Create new user | ✅ Created | ✅ Created | ✅ Yes |
| Update profile | ❌ Not updated | ✅ Updated | ✅ Yes (but metadata may be stale) |
| View in Dashboard | ✅ Auth → Users | ✅ Database → profiles | ✅ Yes (auth.users only) |

## Best Practice

**For your application**:
- ✅ Use `profiles` table as the **source of truth** for personal information
- ✅ Update `profiles` table when users edit their information
- ✅ Query `profiles` table (or `role_profiles` view) to display user information
- ⚠️ `auth.users.user_metadata` is set during account creation and may become stale - that's okay, use `profiles` instead

**For authentication**:
- ✅ Use `auth.users` for authentication (login, password, email)
- ✅ Use `auth.users.id` as the user identifier everywhere
- ✅ Link `profiles.user_id` to `auth.users.id` via FK constraint

## Example: Creating a New User

When you create a new staff user:

1. **Edge Function** (`create-staff-account`) creates:
   - Entry in `auth.users` (via `supabaseAdmin.auth.admin.createUser()`)
   - Entry in `profiles` (via `supabaseAdmin.from("profiles").upsert()`)
   - Entry in `user_roles` (via `supabaseAdmin.from("user_roles").insert()`)

2. **Result**:
   - ✅ User appears in **Supabase Dashboard → Authentication → Users**
   - ✅ Profile appears in **Supabase Dashboard → Database → profiles**
   - ✅ User can log in with the provided email/password

3. **When you update the profile**:
   - ✅ `profiles` table is updated
   - ❌ `auth.users.user_metadata` is **NOT** updated (but that's okay - use `profiles` as source of truth)

