# User Management Structure - Proposed Design

## Current State Analysis

### Current Issues
1. **Data Duplication**: Personal information exists in multiple places:
   - `profiles` table (first_name, surname, full_name, email)
   - `drivers` table (name, email, contact_phone, address, license_number, emergency_contact_name, emergency_contact_phone)
   - `onboarding_sessions` table (full_name, contact_phone, address, emergency_contact_name, emergency_contact_phone, license_number)
   - `auth.users` metadata (full_name, first_name, surname)

2. **Weak Linking**: 
   - `drivers.user_id` exists but is NOT a foreign key constraint
   - Linking is done via email matching (unreliable)
   - No referential integrity enforcement

3. **Multiple Creation Paths**:
   - Self-registration via `create-onboarding-account` (creates onboarding role)
   - Admin creates driver via `create-driver-account` (creates driver role directly)
   - HR onboarding form (creates driver record but may not create user)
   - Onboarding approval workflow (promotes onboarding → driver)

4. **Profile Editing**:
   - No clear profile editing interface for users
   - ProfileScreen reads from drivers table (driver-specific)
   - No unified profile management

---

## Proposed New Structure

### 1. User Creation Process

#### Who Can Create Users & What Users They Can Create

| Role | Can Create | Creation Method | Initial Role | Notes |
|------|------------|----------------|--------------|-------|
| **Public/Anonymous** | Onboarding users | Self-registration form | `onboarding` | Must go through onboarding workflow |
| **Admin** | Any role user | Admin dashboard | `admin`, `hr`, `finance`, `dispatcher`, `driver` | Direct creation with full privileges |
| **HR** | Staff users only (NOT drivers) | HR dashboard | `admin`, `hr`, `finance`, `dispatcher` | **CANNOT create drivers** - drivers only created through onboarding |
| **System** | All users | Edge functions/triggers | Based on workflow | Automated role transitions (onboarding → driver) |

**Important Rule**: Drivers can ONLY be created through the onboarding workflow. HR cannot create drivers directly.

#### Creation Flows

**Flow 1: Self-Registration (Onboarding)**
```
1. User visits /create-account
2. Enters: first_name, surname, email, password
3. Edge function: create-onboarding-account
   - Creates auth.users account
   - Creates profile record (first_name, surname, full_name, email)
   - Assigns 'onboarding' role to user_roles
   - Creates onboarding_sessions record (empty, awaiting completion)
4. User completes onboarding form
5. Onboarding approval workflow promotes to driver
```

**Flow 2: Admin Creates Driver Directly** (Optional - for legacy/special cases)
```
1. Admin uses CreateDriverAccountDialog
2. Enters: name, email, contactPhone, licenseNumber, address, emergencyContactName, emergencyContactPhone
3. Edge function: create-driver-account
   - Creates auth.users account
   - Creates profile record (from name, email)
   - Assigns 'driver' role to user_roles
   - Creates driver record (links via user_id FK)
   - Sets user_id on driver record
```

**Flow 3: HR Creates Staff (Admin/HR/Finance/Dispatcher) - NOT Drivers**
```
1. HR/Admin uses Staff Management page (NEW)
2. Enters: first_name, surname, email, role (admin/hr/finance/dispatcher ONLY), contactPhone (optional)
3. Edge function: create-staff-account (NEW)
   - Creates auth.users account
   - Creates profile record
   - Assigns selected role to user_roles (validates: NOT 'driver' or 'onboarding')
   - NO driver record created
   
NOTE: HR CANNOT create drivers. Drivers must go through onboarding workflow.
```

**Flow 4: Onboarding Approval (Onboarding → Driver)**
```
1. Admin/HR reviews onboarding_sessions
2. Approves application
3. Edge function: approve-onboarding (NEW) or update existing
   - Creates driver record (from onboarding_sessions data)
   - Links driver.user_id = onboarding_sessions.user_id
   - Removes 'onboarding' role
   - Adds 'driver' role
   - Updates profile if onboarding had better data
   - Marks onboarding_sessions as completed
```

---

### 2. Data Storage Structure

#### Primary Tables

**`auth.users`** (Supabase Auth - read-only via admin API)
- `id` (UUID, PK)
- `email` (unique)
- `user_metadata` (JSON - avoid storing business data here)

**`profiles`** (Single Source of Truth for Personal Information)
```sql
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  surname TEXT,
  full_name TEXT,  -- Computed: COALESCE(full_name, first_name || ' ' || surname)
  email TEXT,      -- Denormalized from auth.users for convenience
  contact_phone TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX profiles_email_idx ON profiles(lower(email));
```

**`user_roles`** (Role Assignment - Many-to-Many)
```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);
```

**`drivers`** (Driver-Specific Data - Linked to User)
```sql
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  license_number TEXT,
  license_expiry DATE,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_registration TEXT,
  active BOOLEAN DEFAULT true,
  onboarded_at TIMESTAMPTZ,
  onboarded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint: driver must have 'driver' role
  CONSTRAINT driver_has_driver_role CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = drivers.user_id AND role = 'driver')
  )
);

-- Index
CREATE INDEX drivers_user_id_idx ON drivers(user_id);
```

**`onboarding_sessions`** (Temporary - During Onboarding)
```sql
CREATE TABLE public.onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_ownership_type TEXT NOT NULL CHECK (vehicle_ownership_type IN ('own', 'lease')),
  -- Personal info (copied from profiles, can be updated during onboarding)
  full_name TEXT,
  contact_phone TEXT,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  license_number TEXT,
  license_expiry DATE,
  -- Vehicle info
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_registration TEXT,
  -- Document URLs
  license_document_url TEXT,
  proof_of_address_url TEXT,
  right_to_work_url TEXT,
  vehicle_insurance_url TEXT,
  vehicle_registration_url TEXT,
  -- Status
  current_step INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'accepted', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

#### Data Flow

```
Personal Information Flow:
1. User creates account → profile created (minimal: first_name, surname, email)
2. User completes onboarding → onboarding_sessions stores detailed info
3. Onboarding approved → profile updated from onboarding_sessions, driver record created
4. User edits profile → profile table updated directly

Driver Information Flow:
1. Driver record created with user_id FK
2. Driver-specific data (license, vehicle) stored in drivers table
3. Personal contact info stored in profiles table
4. Driver can edit their profile (personal info) and driver record (license, vehicle)
```

---

### 3. User-to-Driver Linking

#### Current State (Problems)
- `drivers.user_id` exists but is NOT a foreign key
- Linking done via email matching (unreliable, can break)
- No referential integrity

#### Proposed State (Solution)
```sql
-- Add proper FK constraint
ALTER TABLE public.drivers 
  ADD CONSTRAINT drivers_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Ensure uniqueness (one driver record per user)
ALTER TABLE public.drivers 
  ADD CONSTRAINT drivers_user_id_unique 
  UNIQUE (user_id);

-- Add check constraint: driver record requires 'driver' role
ALTER TABLE public.drivers
  ADD CONSTRAINT driver_has_driver_role CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = drivers.user_id 
      AND role = 'driver'
    )
  );
```

#### Linking Process
1. **On Creation**: When driver account created, `user_id` is set immediately
2. **On Approval**: When onboarding approved, `user_id` from `onboarding_sessions.user_id` is used
3. **On Migration**: Existing drivers linked via email matching (one-time migration)
4. **Validation**: Trigger ensures driver record cannot exist without 'driver' role

---

### 4. Profile Editing Permissions

#### Who Can Edit What

| User Type | Can Edit Own Profile | Can Edit Own Driver Record | Can Edit Other Profiles | Can Edit Other Driver Records | Notes |
|-----------|---------------------|---------------------------|------------------------|------------------------------|-------|
| **Driver** | ✅ Yes (first_name, surname, email, contact_phone, address, emergency_contact) | ✅ Yes (license_number, license_expiry, vehicle info) | ❌ No | ❌ No | Edit via ProfileScreen |
| **Onboarding** | ✅ Yes (first_name, surname, email, contact_phone, address, emergency_contact) | N/A (no driver record yet) | ❌ No | ❌ No | Edit during onboarding form |
| **HR** | ✅ Yes (own profile) | N/A | ✅ Yes (**ALL roles**: admin, hr, finance, dispatcher, driver, onboarding) | ✅ Yes (if user is driver) | Staff management page - can edit profiles for ALL users |
| **Admin** | ✅ Yes (own profile) | N/A | ✅ Yes (all profiles for all roles) | ✅ Yes (all driver records) | User management page |
| **Finance** | ✅ Yes (own profile) | N/A | ❌ No | ❌ No (read-only driver data) | Can view but not edit |
| **Dispatcher** | ✅ Yes (own profile) | N/A | ❌ No | ❌ No | Can view driver data for assignment |

#### Profile Editing Screens

**1. User Self-Service Profile Edit** (NEW)
- Route: `/profile/edit`
- Available to: All users
- Editable fields:
  - first_name, surname
  - email (with verification)
  - contact_phone
  - address
  - emergency_contact_name, emergency_contact_phone
- Updates: `profiles` table only
- If user is driver: Also show driver-specific fields (license, vehicle)

**2. Driver Self-Service Driver Record Edit**
- Route: `/profile` (existing, enhance)
- Available to: Drivers only
- Editable fields:
  - License number, license expiry
  - Vehicle make, model, year, registration
- Updates: `drivers` table only
- Personal info links to profile edit screen

**3. HR/Admin Staff Management** (NEW)
- Route: `/admin/staff` or `/hr/staff`
- Available to: Admin, HR
- Features:
  - List all users with roles (all roles: admin, hr, finance, dispatcher, driver, onboarding)
  - Create new staff accounts (admin, hr, finance, dispatcher) - **NOT drivers**
  - Edit user profiles for **ALL roles** (HR can edit any user's profile)
  - Assign/remove roles (HR limited to non-driver roles)
  - View driver records (if user is driver)
  - Edit driver records (if user is driver)
  - **HR CANNOT create drivers** - drivers only through onboarding

**4. HR/Admin Driver Management** (ENHANCE)
- Route: `/hr/drivers` (existing)
- Available to: Admin, HR
- Features:
  - List all drivers
  - **Cannot create driver accounts directly** (must go through onboarding)
  - Edit driver profiles + driver records
  - Approve/reject onboarding applications
  - View onboarding sessions
  - Manage driver-specific data (license, vehicle, etc.)

---

### 5. Referential Integrity (PK & FK Constraints)

#### Core Principle
**Ensure referential integrity is enforced through proper Primary Keys (PK) and Foreign Keys (FK) constraints in the database schema.**

#### Current Schema Issues

**Missing or Weak Foreign Keys:**
- `drivers.user_id` exists but is NOT a proper FK constraint
- `drivers` table linked via email matching (unreliable)
- No FK from activity tables (routes, expenses, incidents) to users
- `profiles.user_id` should be FK to `auth.users(id)` ✅ (already exists)
- `user_roles.user_id` should be FK to `auth.users(id)` ✅ (already exists)
- `onboarding_sessions.user_id` should be FK to `auth.users(id)` ✅ (already exists)

#### Required Foreign Key Constraints

```sql
-- 1. Profiles table (already has FK, but ensure it's correct)
ALTER TABLE profiles 
  ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 2. User roles table (already has FK, but ensure it's correct)
ALTER TABLE user_roles 
  ADD CONSTRAINT user_roles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 3. Drivers table (CRITICAL - currently missing)
ALTER TABLE drivers 
  ADD CONSTRAINT drivers_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Ensure uniqueness (one driver record per user)
ALTER TABLE drivers 
  ADD CONSTRAINT drivers_user_id_unique 
  UNIQUE (user_id);

-- 4. Onboarding sessions (already has FK, but ensure it's correct)
ALTER TABLE onboarding_sessions 
  ADD CONSTRAINT onboarding_sessions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 5. Activity tables should reference drivers, which links to users
-- Routes, expenses, incidents reference drivers.id (which has FK to users via drivers.user_id)
ALTER TABLE routes 
  ADD CONSTRAINT routes_driver_id_fkey 
  FOREIGN KEY (driver_id) 
  REFERENCES drivers(id) 
  ON DELETE CASCADE;

ALTER TABLE expenses 
  ADD CONSTRAINT expenses_driver_id_fkey 
  FOREIGN KEY (driver_id) 
  REFERENCES drivers(id) 
  ON DELETE CASCADE;

ALTER TABLE incidents 
  ADD CONSTRAINT incidents_driver_id_fkey 
  FOREIGN KEY (driver_id) 
  REFERENCES drivers(id) 
  ON DELETE CASCADE;

-- 6. Driver-related tables
ALTER TABLE driver_documents 
  ADD CONSTRAINT driver_documents_driver_id_fkey 
  FOREIGN KEY (driver_id) 
  REFERENCES drivers(id) 
  ON DELETE CASCADE;

ALTER TABLE driver_training_progress 
  ADD CONSTRAINT driver_training_progress_driver_id_fkey 
  FOREIGN KEY (driver_id) 
  REFERENCES drivers(id) 
  ON DELETE CASCADE;

-- 7. Notifications (already uses user_id, ensure FK exists)
ALTER TABLE notifications 
  ADD CONSTRAINT notifications_sender_id_fkey 
  FOREIGN KEY (sender_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

ALTER TABLE notifications 
  ADD CONSTRAINT notifications_recipient_id_fkey 
  FOREIGN KEY (recipient_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 8. Messages (already uses user_id, ensure FK exists)
ALTER TABLE messages 
  ADD CONSTRAINT messages_sender_id_fkey 
  FOREIGN KEY (sender_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

ALTER TABLE messages 
  ADD CONSTRAINT messages_receiver_id_fkey 
  FOREIGN KEY (receiver_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 9. Referenced users in other tables
ALTER TABLE drivers 
  ADD CONSTRAINT drivers_onboarded_by_fkey 
  FOREIGN KEY (onboarded_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

ALTER TABLE onboarding_sessions 
  ADD CONSTRAINT onboarding_sessions_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;
```

#### Primary Key Constraints

**Ensure all tables have proper primary keys:**
- `auth.users.id` - UUID, PK ✅ (Supabase managed)
- `profiles.user_id` - UUID, PK, FK to auth.users ✅
- `user_roles.id` - UUID, PK ✅
- `drivers.id` - UUID, PK ✅
- `drivers.user_id` - UUID, UNIQUE, FK to auth.users ⚠️ (needs FK constraint)
- `onboarding_sessions.id` - UUID, PK ✅
- `routes.id` - UUID, PK ✅
- `expenses.id` - UUID, PK ✅
- `incidents.id` - UUID, PK ✅

#### Cascade Delete Behavior

**ON DELETE CASCADE** (child records deleted when parent deleted):
- `profiles` → deleted when `auth.users` deleted
- `user_roles` → deleted when `auth.users` deleted
- `drivers` → deleted when `auth.users` deleted
- `onboarding_sessions` → deleted when `auth.users` deleted
- `routes` → deleted when `drivers` deleted
- `expenses` → deleted when `drivers` deleted
- `incidents` → deleted when `drivers` deleted
- `driver_documents` → deleted when `drivers` deleted
- `driver_training_progress` → deleted when `drivers` deleted
- `notifications` → deleted when sender/recipient `auth.users` deleted
- `messages` → deleted when sender/receiver `auth.users` deleted

**ON DELETE SET NULL** (reference set to NULL when parent deleted):
- `drivers.onboarded_by` → set to NULL when referenced user deleted
- `onboarding_sessions.reviewed_by` → set to NULL when referenced user deleted

#### User Visibility in Lists

**Users appear in lists they need to unless otherwise specified:**

1. **Messaging/Notifications**:
   - Users appear in recipient lists based on their roles
   - Role-based filtering: `role_profiles` view provides users by role
   - All users with a role appear in their role's list
   - Users excluded only if:
     - They don't have the selected role
     - Explicitly filtered out (e.g., inactive drivers)
     - Self (sender excluded from own recipient list)

2. **Staff Management Lists**:
   - HR/Admin see all users with all roles
   - Filterable by role
   - Users appear regardless of active status (unless filtered)

3. **Driver Lists**:
   - Only users with 'driver' role AND driver record appear
   - Filterable by active status
   - Used for route assignment, payroll, etc.

4. **Onboarding Lists**:
   - Only users with 'onboarding' role appear
   - Filterable by status (in_progress, submitted, accepted, rejected)

#### User Profile Display

**All user lists should display:**
- Full name (from profiles.full_name or computed from first_name + surname)
- Email (from profiles.email, fallback to auth.users.email)
- Role(s) (from user_roles)
- User ID (for admin/technical purposes)

**Format**: "First Last" (fallback to email if name missing, fallback to user_id if email missing)

---

### 6. Business Rule Enforcement (Triggers)

#### Database Triggers for Business Rules

While FK constraints enforce referential integrity, triggers enforce business logic:

```sql
-- 1. Driver record must have 'driver' role (enforced via trigger)
CREATE OR REPLACE FUNCTION enforce_driver_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.user_id 
    AND role = 'driver'
  ) THEN
    RAISE EXCEPTION 'Driver record requires user to have driver role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER driver_role_check
  BEFORE INSERT OR UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION enforce_driver_role();

-- 2. Onboarding session must have 'onboarding' role (enforced via trigger)
CREATE OR REPLACE FUNCTION enforce_onboarding_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.user_id 
    AND role = 'onboarding'
  ) THEN
    RAISE EXCEPTION 'Onboarding session requires user to have onboarding role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER onboarding_role_check
  BEFORE INSERT OR UPDATE ON onboarding_sessions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_onboarding_role();

-- 3. Ensure profile exists when user gets a role (optional - can be handled in application)
CREATE OR REPLACE FUNCTION ensure_profile_exists()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, email)
  SELECT NEW.user_id, u.email
  FROM auth.users u
  WHERE u.id = NEW.user_id
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_role_profile_check
  AFTER INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_profile_exists();
```

#### Application-Level Validation

- Edge functions validate role assignments before creating records
- UI prevents invalid role combinations
- API endpoints check permissions before allowing edits
- FK constraints prevent orphaned records at the database level

---

### 7. Data Migration Plan

#### Step 1: Add Foreign Key Constraint
```sql
-- Backfill user_id for existing drivers
UPDATE drivers d
SET user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(d.email)
  AND d.user_id IS NULL;

-- Add FK constraint
ALTER TABLE drivers 
  ADD CONSTRAINT drivers_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;
```

#### Step 2: Consolidate Personal Information
```sql
-- Update profiles from drivers table (for drivers without complete profiles)
UPDATE profiles p
SET 
  contact_phone = COALESCE(p.contact_phone, d.contact_phone),
  address = COALESCE(p.address, d.address),
  emergency_contact_name = COALESCE(p.emergency_contact_name, d.emergency_contact_name),
  emergency_contact_phone = COALESCE(p.emergency_contact_phone, d.emergency_contact_phone)
FROM drivers d
WHERE p.user_id = d.user_id
  AND d.user_id IS NOT NULL;
```

#### Step 3: Update Onboarding Approval
- Modify approval workflow to:
  1. Update profile from onboarding_sessions
  2. Create driver record with user_id FK
  3. Remove onboarding role, add driver role
  4. Link driver.user_id = onboarding_sessions.user_id

---

### 8. Summary: Single Source of Truth

| Data Type | Stored In | Accessed Via | Updated By |
|-----------|-----------|--------------|------------|
| **User Account** | `auth.users` | Supabase Auth API | Admin/Edge Functions |
| **Personal Info** | `profiles` | Profiles table | User (self-service) / HR / Admin |
| **Roles** | `user_roles` | User roles table | Admin / HR / Edge Functions |
| **Driver-Specific Data** | `drivers` | Drivers table | Driver (self-service) / HR / Admin |
| **Onboarding Data** | `onboarding_sessions` | Onboarding sessions table | User (during onboarding) / Admin (approval) |

**Key Principles:**
1. **One profile per user** (1:1 relationship with auth.users, enforced via PK/FK)
2. **One driver record per driver user** (1:1 relationship with auth.users, optional, enforced via UNIQUE constraint)
3. **Multiple roles per user** (many-to-many via user_roles, FK to auth.users)
4. **Personal info in profiles, driver-specific info in drivers**
5. **FK constraints enforce referential integrity** - all user references use proper FK constraints
6. **CASCADE deletes** - deleting a user cascades to profiles, roles, drivers, and related records
7. **Triggers enforce business rules** (e.g., driver record requires 'driver' role)
8. **Users appear in lists based on roles** - visible unless explicitly filtered
9. **Drivers only created through onboarding** - HR cannot create drivers directly
10. **HR can edit profiles for ALL roles** - full profile management capability

---

## Implementation Phases

### Phase 1: Immediate Fixes (Current Blocker)
- Fix recipient list in Compose
- Validate send-notification edge function
- Ensure reply/mark-read still work

### Phase 2: Schema & Referential Integrity (Foundation)
- Add FK constraints to all tables referencing users
- Add FK constraint to drivers.user_id (CRITICAL)
- Add UNIQUE constraint to drivers.user_id
- Add FK constraints to activity tables (routes, expenses, incidents → drivers)
- Add FK constraints to notification/message tables
- Add triggers for business rule validation (driver role, onboarding role)
- Migrate existing data (backfill user_id where missing)
- Update RLS policies
- Test cascade delete behavior

### Phase 3: Profile Management (User Experience)
- Build user self-service profile edit
- Enhance driver profile screen
- Build HR/Admin staff management page (HR can edit all profiles, cannot create drivers)
- Update onboarding approval workflow
- Ensure users appear in all relevant lists (messaging, staff management, etc.)

### Phase 4: Cleanup & Optimization
- Remove data duplication
- Consolidate personal info into profiles
- Update all queries to use proper relationships
- Add comprehensive RLS policies

---

## Open Questions

1. **Email Changes**: Should users be able to change their email? If yes, how to handle auth.users email update?
2. **Profile Deletion**: Should deleting a user cascade delete profile and driver record? (Yes, via FK CASCADE)
3. **Role Transitions**: Can a driver become an admin? How to handle driver record in that case? (Keep driver record, add admin role)
4. **Onboarding Rejection**: What happens to onboarding_sessions when rejected? Keep for audit or delete? (Keep for audit trail)
5. **Historical Data**: Should we keep onboarding_sessions after approval, or archive them? (Keep for audit trail)
6. **User Inactivity**: Should inactive users (e.g., inactive drivers) be filtered from lists by default? (Yes, with option to show all)
7. **Profile Completeness**: Should we enforce profile completeness before allowing certain actions? (Optional validation)

---

## Next Steps

1. **Review this document** and approve the structure
2. **Phase 1**: Fix immediate messaging issues
3. **Phase 2**: Implement schema changes and migrations
4. **Phase 3**: Build profile management UI
5. **Phase 4**: Test and refine

