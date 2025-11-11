# Data Model Reference

## Overview

This document defines what information is stored where in the database, and how users, profiles, and driver records relate to each other.

---

## Core Tables

### 1. `auth.users` (Supabase Auth - Read-Only)

**Purpose**: Core user authentication and account management (managed by Supabase Auth)

**Fields**:
- `id` (UUID, PK) - User ID (references everywhere as `user_id`)
- `email` (TEXT, UNIQUE) - User email address
- `user_metadata` (JSONB) - Metadata (full_name, first_name, surname, requires_password_change)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Key Points**:
- Managed by Supabase Auth
- Cannot be directly modified via SQL (use Admin API)
- All user references in other tables use `auth.users.id`

---

### 2. `profiles` (Personal Information - ALL Users)

**Purpose**: Store personal information for ALL users (admin, hr, finance, dispatcher, driver, onboarding)

**Fields**:
- `user_id` (UUID, PK, FK → auth.users.id) - One profile per user
- `first_name` (TEXT) - First name
- `surname` (TEXT) - Last name
- `full_name` (TEXT) - Full name (computed or stored)
- `email` (TEXT) - Email (denormalized from auth.users for convenience)
- `contact_phone` (TEXT) - Contact phone number
- `address` (TEXT) - Full address
- `emergency_contact_name` (TEXT) - Emergency contact name
- `emergency_contact_phone` (TEXT) - Emergency contact phone
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Key Points**:
- **One profile per user** (1:1 relationship)
- Contains personal information for ALL user types
- Updated by: User (self-service), HR, Admin
- FK constraint ensures referential integrity

**Who Can Edit**:
- Users can edit their own profile
- HR can edit any user's profile
- Admin can edit any user's profile

---

### 3. `user_roles` (Role Assignment)

**Purpose**: Assign roles to users (many-to-many relationship)

**Fields**:
- `id` (UUID, PK)
- `user_id` (UUID, FK → auth.users.id) - User reference
- `role` (app_role ENUM) - Role: 'admin', 'hr', 'finance', 'dispatcher', 'driver', 'onboarding'
- `created_at` (TIMESTAMPTZ)

**Key Points**:
- **Many-to-many**: Users can have multiple roles
- UNIQUE constraint on (user_id, role)
- FK constraint ensures referential integrity
- Roles: admin, hr, finance, dispatcher, driver, onboarding

**Who Can Manage**:
- Admin can assign/remove any role
- HR can assign/remove non-driver roles (admin, hr, finance, dispatcher)
- System assigns roles automatically (onboarding → driver)

---

### 4. `drivers` (Driver-Specific Data)

**Purpose**: Store driver-specific information (license, vehicle, etc.)

**Fields**:
- `id` (UUID, PK) - Driver record ID
- `user_id` (UUID, UNIQUE, FK → auth.users.id) - **ONE driver record per user**
- `license_number` (TEXT) - Driver's license number
- `license_expiry` (DATE) - License expiry date
- `vehicle_make` (TEXT) - Vehicle make
- `vehicle_model` (TEXT) - Vehicle model
- `vehicle_year` (INTEGER) - Vehicle year
- `vehicle_registration` (TEXT) - Vehicle registration number
- `active` (BOOLEAN) - Is driver active
- `onboarded_at` (TIMESTAMPTZ) - When driver was onboarded
- `onboarded_by` (UUID, FK → auth.users.id) - Who onboarded the driver
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Key Points**:
- **One driver record per user** (1:1 relationship via user_id UNIQUE constraint)
- Contains driver-specific data (license, vehicle)
- **Personal info (contact_phone, address, emergency_contact) is in `profiles` table**
- FK constraint ensures referential integrity
- Trigger ensures user has 'driver' role

**Who Can Edit**:
- Drivers can edit their own driver record (license, vehicle)
- HR can edit any driver record
- Admin can edit any driver record

---

### 5. `onboarding_sessions` (Onboarding Data - Temporary)

**Purpose**: Store onboarding application data (temporary, until approved)

**Fields**:
- `id` (UUID, PK)
- `user_id` (UUID, FK → auth.users.id) - User reference
- `vehicle_ownership_type` (TEXT) - 'own' or 'lease'
- `full_name` (TEXT) - Full name
- `contact_phone` (TEXT) - Contact phone
- `address` (TEXT) - Address
- `emergency_contact_name` (TEXT) - Emergency contact name
- `emergency_contact_phone` (TEXT) - Emergency contact phone
- `license_number` (TEXT) - License number
- `license_expiry` (DATE) - License expiry
- `vehicle_make` (TEXT) - Vehicle make
- `vehicle_model` (TEXT) - Vehicle model
- `vehicle_year` (INTEGER) - Vehicle year
- `vehicle_registration` (TEXT) - Vehicle registration
- `license_document_url` (TEXT) - License document URL
- `proof_of_address_url` (TEXT) - Proof of address URL
- `right_to_work_url` (TEXT) - Right to work URL
- `vehicle_insurance_url` (TEXT) - Vehicle insurance URL
- `vehicle_registration_url` (TEXT) - Vehicle registration URL
- `current_step` (INTEGER) - Current step in onboarding
- `completed` (BOOLEAN) - Is onboarding completed
- `status` (TEXT) - 'in_progress', 'submitted', 'accepted', 'rejected'
- `reviewed_by` (UUID, FK → auth.users.id) - Who reviewed the application
- `reviewed_at` (TIMESTAMPTZ) - When reviewed
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `completed_at` (TIMESTAMPTZ) - When completed

**Key Points**:
- **Temporary storage** during onboarding process
- Data is copied to `profiles` and `drivers` tables when approved
- Trigger ensures user has 'onboarding' role
- FK constraint ensures referential integrity

---

## Data Flow

### User Creation Flow

```
1. User Account Created (auth.users)
   ↓
2. Profile Created (profiles)
   - first_name, surname, email (from user creation)
   - contact_phone, address, emergency_contact (optional, added later)
   ↓
3. Role Assigned (user_roles)
   - 'onboarding' (for self-registration)
   - 'admin', 'hr', 'finance', 'dispatcher' (for staff)
   ↓
4. If Driver:
   - Onboarding session created (onboarding_sessions)
   - Onboarding completed → Driver record created (drivers)
   - Personal info copied from onboarding_sessions to profiles
   - Driver-specific info (license, vehicle) stored in drivers table
```

### Data Relationships

```
auth.users (1) ──┐
                 │
                 ├──> profiles (1:1) - Personal info for ALL users
                 │
                 ├──> user_roles (1:many) - Roles assigned to user
                 │
                 ├──> drivers (1:0..1) - Driver record (if user is driver)
                 │       │
                 │       └──> routes (1:many) - Driver's routes
                 │       └──> expenses (1:many) - Driver's expenses
                 │       └──> incidents (1:many) - Driver's incidents
                 │
                 └──> onboarding_sessions (1:0..1) - Onboarding data (if onboarding)
```

---

## What Information is Stored Where

### Personal Information (ALL Users)
**Stored in**: `profiles` table
- first_name
- surname
- full_name
- email
- contact_phone
- address
- emergency_contact_name
- emergency_contact_phone

### Driver-Specific Information (Drivers Only)
**Stored in**: `drivers` table
- license_number
- license_expiry
- vehicle_make
- vehicle_model
- vehicle_year
- vehicle_registration
- active
- onboarded_at
- onboarded_by

### Role Information (ALL Users)
**Stored in**: `user_roles` table
- role (admin, hr, finance, dispatcher, driver, onboarding)

### Onboarding Data (Onboarding Users Only)
**Stored in**: `onboarding_sessions` table
- All onboarding form data
- Documents (URLs)
- Status and progress

---

## Forms That Collect Data

### 1. Staff Creation Form (Admin)
**Location**: `src/components/admin/StaffManagement.tsx`
**Collects**:
- first_name
- surname
- email
- role (admin, hr, finance, dispatcher)
- password
- contact_phone (optional)

**Stores in**:
- `auth.users` (via create-staff-account edge function)
- `profiles` (first_name, surname, email, contact_phone)
- `user_roles` (role)

### 2. Profile Edit Form (All Users)
**Location**: `src/components/admin/StaffManagement.tsx` (edit), User self-service (to be created)
**Collects**:
- first_name
- surname
- contact_phone
- address
- emergency_contact_name
- emergency_contact_phone

**Stores in**:
- `profiles` table

### 3. Driver Profile Edit (Drivers Only)
**Location**: `src/pages/ProfileScreen.tsx`
**Collects**:
- license_number
- license_expiry
- vehicle_make
- vehicle_model
- vehicle_year
- vehicle_registration

**Stores in**:
- `drivers` table

### 4. Onboarding Form (Onboarding Users)
**Location**: `src/components/onboarding/OnboardingFormOwn.tsx`, `OnboardingFormLease.tsx`
**Collects**:
- Personal info (first_name, surname, contact_phone, address, emergency_contact)
- License info (license_number, license_expiry)
- Vehicle info (vehicle_make, model, year, registration)
- Documents (license_document_url, proof_of_address_url, etc.)

**Stores in**:
- `onboarding_sessions` table
- When approved: copied to `profiles` and `drivers` tables

---

## Adding New Fields

### To Add a Field to ALL Users:

1. **Add column to `profiles` table**:
   ```sql
   ALTER TABLE public.profiles
     ADD COLUMN new_field TEXT;
   ```

2. **Update `role_profiles` view** (if needed):
   ```sql
   CREATE OR REPLACE VIEW public.role_profiles AS
   SELECT 
     ur.role,
     p.user_id,
     p.full_name,
     p.first_name,
     p.surname,
     p.email,
     p.new_field,  -- Add new field
     ...
   FROM public.user_roles ur
   LEFT JOIN public.profiles p ON p.user_id = ur.user_id;
   ```

3. **Update forms**:
   - StaffManagement.tsx (create/edit staff)
   - User profile edit form
   - Any other forms that display/edit user data

4. **Update TypeScript types**:
   - Update PersonName type
   - Update StaffUser type
   - Update any other relevant types

### To Add a Field to Drivers Only:

1. **Add column to `drivers` table**:
   ```sql
   ALTER TABLE public.drivers
     ADD COLUMN new_field TEXT;
   ```

2. **Update forms**:
   - Driver profile edit form
   - Onboarding form (if field is collected during onboarding)
   - HR driver management form

3. **Update TypeScript types**:
   - Update Driver type
   - Update onboarding form types

---

## Key Principles

1. **Personal info in `profiles`**: All personal information (name, contact, address, emergency contact) is stored in `profiles` table for ALL users
2. **Driver-specific info in `drivers`**: Driver-specific data (license, vehicle) is stored in `drivers` table
3. **One profile per user**: Every user has exactly one profile (1:1 relationship)
4. **One driver record per driver**: Every driver has exactly one driver record (1:1 relationship)
5. **FK constraints**: All user references use FK constraints to ensure referential integrity
6. **Cascade deletes**: Deleting a user cascades to profiles, roles, drivers, and related records
7. **Forms align with database**: All forms that collect data should match the database schema

---

## Common Queries

### Get User with Profile and Roles
```sql
SELECT 
  u.id,
  u.email,
  p.first_name,
  p.surname,
  p.full_name,
  p.contact_phone,
  p.address,
  array_agg(ur.role) as roles
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.id = '...'
GROUP BY u.id, u.email, p.first_name, p.surname, p.full_name, p.contact_phone, p.address;
```

### Get Driver with Profile
```sql
SELECT 
  d.id as driver_id,
  d.user_id,
  p.first_name,
  p.surname,
  p.full_name,
  p.contact_phone,
  p.address,
  p.emergency_contact_name,
  p.emergency_contact_phone,
  d.license_number,
  d.license_expiry,
  d.vehicle_make,
  d.vehicle_model,
  d.vehicle_year,
  d.vehicle_registration
FROM public.drivers d
JOIN public.profiles p ON p.user_id = d.user_id
WHERE d.user_id = '...';
```

### Get All Staff (Non-Drivers)
```sql
SELECT 
  p.user_id,
  p.first_name,
  p.surname,
  p.full_name,
  p.email,
  p.contact_phone,
  array_agg(ur.role) as roles
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE ur.role IN ('admin', 'hr', 'finance', 'dispatcher')
GROUP BY p.user_id, p.first_name, p.surname, p.full_name, p.email, p.contact_phone;
```

---

## Migration Notes

- When adding new fields to `profiles`, update the `role_profiles` view
- When adding new fields to `drivers`, consider if they should be in `profiles` instead (if they're personal info)
- Always update TypeScript types when adding database fields
- Always update forms when adding database fields
- Test RLS policies after adding new fields

