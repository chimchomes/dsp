# Current Features - DSP Application

**Last Updated**: November 2025

## ✅ Working Features

### Authentication & Access Control

- ✅ Multi-role authentication system
- ✅ Role-based login redirects
- ✅ Password change on first login
- ✅ Session management
- ✅ AuthGuard component with fallback logic
- ✅ Automatic role detection and routing

**Roles Supported**:
- Admin
- Dispatcher
- Finance
- HR
- Driver
- Onboarding (temporary)
- Inactive (limited access)

### Admin Dashboard (`/admin/control-panel`)

**Staff Management Tab**:
- ✅ Create staff accounts (Admin, HR, Finance, Dispatcher)
- ✅ View all staff members
- ✅ Edit staff profiles (personal info, address, emergency contacts)
- ✅ Deactivate staff (removes access, preserves work history)
- ✅ Reactivate staff (restores access and roles)
- ✅ Filter staff by name/email
- ✅ Filter staff by role (Admin, HR, Finance, Dispatcher)
- ✅ Filter staff by status (Active, Inactive, All)
- ✅ Search functionality with clear button
- ✅ Status badges (Active/Inactive)
- ✅ Real-time updates

**Driver Management Tab**:
- ✅ View all drivers
- ✅ Edit driver profiles (personal + driver-specific data)
- ✅ Activate/deactivate drivers
- ✅ View license information
- ✅ View vehicle information
- ✅ Real-time driver list updates
- ✅ Proper data source handling (profiles + drivers tables)

**Onboarding Applications Tab**:
- ✅ View all onboarding applications
- ✅ Filter by status (in_progress, submitted, accepted, rejected, re-submit)
- ✅ View complete application details
- ✅ Approve applications (creates driver record, assigns role)
- ✅ Reject applications
- ✅ Request resubmission
- ✅ Status badges
- ✅ Application review tracking (reviewed_by, reviewed_at)

**User Roles Tab**:
- ✅ View all users with roles
- ✅ Assign roles to users
- ✅ Remove roles from users
- ✅ Role management interface

**Metrics Tab**:
- ✅ System statistics
- ✅ User counts by role
- ✅ Driver statistics

**Activity Logs Tab**:
- ✅ View system activity logs
- ✅ Filter by action type
- ✅ User activity tracking

**Reports Tab**:
- ✅ Export functionality
- ✅ Report generation

### Staff Management

- ✅ Create new staff accounts with role assignment
- ✅ Edit existing staff profiles
- ✅ Deactivate staff (adds inactive role, removes access)
- ✅ Reactivate staff (removes inactive role, restores access)
- ✅ Staff filtering (name, role, status)
- ✅ Search by name or email
- ✅ Inactive staff hidden from selectable lists
- ✅ Inactive staff visible in Staff Management tab only

### Driver Management

- ✅ View all drivers with complete information
- ✅ Edit driver personal information (profiles table)
- ✅ Edit driver-specific data (license, vehicle)
- ✅ Activate/deactivate drivers
- ✅ Real-time updates when drivers are added/modified
- ✅ Proper data merging from profiles and drivers tables
- ✅ Fallback to drivers.name if profile data missing

### Onboarding Workflow

**Application Process**:
- ✅ Create onboarding account
- ✅ Multi-step form (6 pages) for own vehicle
- ✅ Multi-step form (6 pages) for leased vehicle
- ✅ Save progress functionality
- ✅ Form validation
- ✅ File uploads (license, passport, photos)
- ✅ Status tracking (in_progress, submitted, accepted, rejected, re-submit)

**Status-Based Editing**:
- ✅ Users can edit when status is: `in_progress`, `re-submit`, `rejected`
- ✅ Users cannot edit when status is: `submitted`, `accepted`
- ✅ Status banners showing current application status
- ✅ Exit functionality (bypasses dialog if read-only)

**Admin Review**:
- ✅ Approve → Creates driver record, assigns driver role
- ✅ Reject → Updates status, user can resubmit
- ✅ Request Resubmit → Changes status to re-submit, allows editing
- ✅ Prevents duplicate driver records
- ✅ Updates profile with onboarding data

### Finance Dashboard (`/finance`)

- ✅ Expense review and approval
- ✅ Payroll management
- ✅ Financial reports
- ✅ Manual deductions
- ✅ Access control (Finance, Admin, Dispatcher roles)

### HR Dashboard (`/hr`)

- ✅ Driver onboarding forms
- ✅ Training management
- ✅ Driver table view
- ✅ Access control (HR, Admin roles)

### Dispatcher Dashboard (`/dispatcher`)

- ✅ Route assignment
- ✅ Driver management panel
- ✅ Incident tracking
- ✅ Messaging to drivers
- ✅ Access control (Dispatcher, Admin roles)

### Driver Portal (`/dashboard`)

- ✅ View assigned routes
- ✅ Route status updates
- ✅ Submit expenses
- ✅ View earnings
- ✅ Cost calculator
- ✅ Vehicle management
- ✅ Profile management
- ✅ Inbox for messages
- ✅ Access control (Driver role)

### Messaging System

- ✅ Inbox for all users
- ✅ Real-time notifications
- ✅ Unread message indicator (red dot)
- ✅ Admin messaging to roles/users
- ✅ Role-based recipient filtering
- ✅ Inactive users excluded from recipient lists

### Profile Management

- ✅ Driver profile screen
- ✅ Personal information display
- ✅ Driver-specific information display
- ✅ Emergency contact information
- ✅ Admin can edit all profiles
- ✅ Users can view their own profile

## 🔄 Workflows

### Staff Deactivation Workflow

1. Admin clicks "Deactivate" on staff member
2. Confirmation dialog appears
3. System adds "inactive" role
4. Staff member loses all access
5. Staff member no longer appears in selectable lists
6. Staff member still visible in Staff Management tab (marked as Inactive)
7. Work history preserved

### Staff Reactivation Workflow

1. Admin clicks "Reactivate" on inactive staff
2. Confirmation dialog appears
3. System removes "inactive" role
4. Original staff roles restored
5. Staff member regains access
6. Staff member appears in selectable lists again

### Onboarding Approval Workflow

1. Applicant completes onboarding form
2. Status changes to "submitted"
3. Admin reviews application
4. Admin approves → System:
   - Creates driver record in `drivers` table
   - Updates profile with personal info
   - Removes onboarding role
   - Assigns driver role
   - Sets status to "accepted"
5. Driver can now log in to portal

### Driver Record Creation

- ✅ Automatic on onboarding approval
- ✅ Includes all onboarding data (license, vehicle, personal info)
- ✅ Links to user via `user_id` foreign key
- ✅ Prevents duplicate records
- ✅ Backfill migration available for existing users

## 🎯 Access Control Matrix

| Feature | Admin | Dispatcher | Finance | HR | Driver | Inactive |
|---------|-------|------------|---------|----|----|---------|
| Admin Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Staff Management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Driver Management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Onboarding Review | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Dispatcher Dashboard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Finance Dashboard | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| HR Dashboard | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Driver Dashboard | ✅* | ❌ | ❌ | ❌ | ✅ | ❌ |
| Inbox | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Own Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Admin can access driver dashboard but typically uses admin dashboard

## 🔒 Security Features

- ✅ Row Level Security (RLS) on all tables
- ✅ Role-based access control
- ✅ AuthGuard component on protected routes
- ✅ Password change requirement on first login
- ✅ Session management
- ✅ Secure file uploads to Supabase Storage
- ✅ API key validation

## 📊 Data Sources

### Driver List
- Primary: `drivers` table (name, email, license, vehicle)
- Secondary: `profiles` table (personal info, contact, address)
- Merged display with fallback logic

### Staff List
- Primary: `user_roles` table (role assignments)
- Secondary: `profiles` table (personal info)
- Filters out inactive users from selectable lists

### Onboarding Applications
- Source: `onboarding_sessions` table
- Status tracking: `status` column
- Review tracking: `reviewed_by`, `reviewed_at`

## 🚨 Known Limitations

- Staff deactivation keeps original roles for display (for reactivation)
- Driver records require manual backfill for pre-existing users (migration available)
- Some features require specific RLS policies to be in place

## 📝 Notes

- All personal information stored in `profiles` table
- Driver-specific data stored in `drivers` table
- Role assignments in `user_roles` table
- Inactive users have "inactive" role added (doesn't remove other roles)
- Real-time updates via Supabase subscriptions where applicable

