# Testing Instructions - Complete Application

## 🧪 Testing Checklist

### Authentication & Login

- [ ] **Admin Login**
  - Log in as admin
  - Verify redirect to `/admin`
  - Verify can access Admin Control Panel
  - Verify all tabs accessible

- [ ] **Finance Login**
  - Log in as finance user
  - Verify redirect to `/finance`
  - Verify Finance Dashboard accessible
  - Verify can access expense review, payroll, reports

- [ ] **HR Login**
  - Log in as HR user
  - Verify redirect to `/hr`
  - Verify HR Dashboard accessible

- [ ] **Dispatcher Login**
  - Log in as dispatcher
  - Verify redirect to `/dispatcher`
  - Verify Dispatcher Dashboard accessible

- [ ] **Driver Login**
  - Log in as driver
  - Verify redirect to `/dashboard`
  - Verify Driver Dashboard accessible

- [ ] **Onboarding Login**
  - Log in as onboarding user
  - Verify redirect to `/onboarding`
  - Verify can access onboarding form

- [ ] **Inactive User Login**
  - Log in as inactive user
  - Verify redirect to `/inbox`
  - Verify cannot access other dashboards

### Staff Management

- [ ] **Create Staff Account**
  - Go to Admin → Staff tab
  - Click "Create Staff Account"
  - Fill in all fields
  - Select role (Admin, HR, Finance, Dispatcher)
  - Submit
  - Verify staff appears in list
  - Verify new staff can log in

- [ ] **Edit Staff Profile**
  - Click "Edit" on staff member
  - Update personal information
  - Update address fields
  - Update emergency contact
  - Save
  - Verify changes saved

- [ ] **Deactivate Staff**
  - Click "Deactivate" on active staff
  - Confirm action
  - Verify status changes to "Inactive"
  - Verify staff no longer appears in selectable lists
  - Verify staff still visible in Staff Management tab
  - Verify staff cannot log in

- [ ] **Reactivate Staff**
  - Click "Reactivate" on inactive staff
  - Confirm action
  - Verify status changes to "Active"
  - Verify staff appears in selectable lists again
  - Verify staff can log in

- [ ] **Filter Staff**
  - Test search by name
  - Test search by email
  - Test filter by role
  - Test filter by status
  - Test combined filters
  - Test clear search

### Driver Management

- [ ] **View Drivers**
  - Go to Admin → Drivers tab
  - Verify all drivers display
  - Verify columns show correct data
  - Verify real-time updates work

- [ ] **Edit Driver**
  - Click "Edit" on driver
  - Update personal information
  - Update driver-specific data (license, vehicle)
  - Change active status
  - Save
  - Verify changes saved
  - Verify table refreshes

- [ ] **Driver Record Creation**
  - Approve onboarding application
  - Verify driver record created
  - Verify driver appears in Driver Management
  - Verify driver can log in

### Onboarding Workflow

- [ ] **Create Onboarding Account**
  - Go to `/create-account`
  - Fill in name and email
  - Submit
  - Verify account created

- [ ] **Complete Onboarding Form**
  - Log in as onboarding user
  - Select vehicle type (own/lease)
  - Complete all 6 pages
  - Test "Save Progress"
  - Test navigation (Previous/Next)
  - Submit application
  - Verify status changes to "submitted"

- [ ] **Status-Based Editing**
  - As submitted user, verify cannot edit
  - Verify status banner shows "Submitted"
  - Verify exit bypasses dialog
  - Admin requests resubmit
  - Verify status changes to "re-submit"
  - Verify can now edit
  - Make changes and resubmit

- [ ] **Admin Review**
  - View onboarding application
  - Review all details
  - Approve application
  - Verify driver record created
  - Verify driver role assigned
  - Verify driver can log in

- [ ] **Re-submit Workflow**
  - Admin requests resubmission
  - User receives notification
  - User can edit form
  - User resubmits
  - Status changes back to "submitted"

### Finance Dashboard

- [ ] **Access Control**
  - Finance user can access
  - Admin can access
  - Dispatcher can access
  - Other roles cannot access

- [ ] **Expense Review**
  - View expenses
  - Approve/reject expenses
  - Verify updates work

- [ ] **Payroll**
  - View payroll table
  - Add manual deductions
  - Verify calculations

- [ ] **Reports**
  - Generate reports
  - Export functionality
  - Verify data accuracy

### HR Dashboard

- [ ] **Access Control**
  - HR user can access
  - Admin can access
  - Other roles cannot access

- [ ] **Driver Onboarding**
  - Create driver via form
  - Verify driver created
  - Verify appears in drivers list

- [ ] **Training Management**
  - View training items
  - Track driver progress
  - Verify updates work

### Dispatcher Dashboard

- [ ] **Route Assignment**
  - Assign route to driver
  - Verify route appears for driver
  - Update route status

- [ ] **Messaging**
  - Send message to driver
  - Verify driver receives message
  - Verify unread indicator

### Driver Portal

- [ ] **Routes**
  - View assigned routes
  - Update route status
  - View route details

- [ ] **Expenses**
  - Submit expense
  - Upload receipt
  - Verify submission

- [ ] **Profile**
  - View profile
  - Verify all information displays
  - Verify data matches admin view

- [ ] **Inbox**
  - View messages
  - Mark as read
  - Verify unread indicator

### Messaging System

- [ ] **Unread Indicator**
  - Verify red dot appears with unread messages
  - Mark message as read
  - Verify red dot disappears
  - Receive new message
  - Verify red dot appears immediately

- [ ] **Admin Messaging**
  - Send message to role
  - Send message to specific user
  - Verify recipients receive message
  - Verify inactive users excluded

### Error Handling

- [ ] **Login Errors**
  - Test invalid credentials
  - Verify error message displays
  - Test user with no role
  - Verify helpful error message

- [ ] **Access Errors**
  - Try accessing unauthorized page
  - Verify redirect to login
  - Verify error handling

- [ ] **Database Errors**
  - Test with missing data
  - Verify fallback logic works
  - Verify error messages helpful

## 🐛 Known Issues to Test

- [ ] Driver record creation on approval
- [ ] Staff deactivation preserves work history
- [ ] Login redirects for all roles
- [ ] Filtering excludes inactive users
- [ ] Real-time updates work correctly

## 📝 Testing Notes

- Test on different browsers
- Test on mobile devices
- Test with slow network (throttle in DevTools)
- Test with multiple users simultaneously
- Verify console has no errors
- Verify network requests succeed

---

## Original Onboarding Form Testing


## Quick Test (Without Migration)
You can test the UI without running the migration, but **saving will fail** because the database columns don't exist yet.

1. Start dev server: `npm run dev`
2. Navigate to `/onboarding` or `/create-account`
3. Test the form UI and navigation between pages
4. Note: Saving progress will show an error until migration is run

## Full Test (With Migration)

### Step 1: Run the Migration

**Option A: Via Supabase Dashboard (Easiest)**
1. Go to your Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/20251101120000_add_onboarding_fields.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click "Run" or press Ctrl+Enter
6. You should see "Success" message

**Option B: Via Supabase CLI (If installed)**
```bash
# If you have Supabase CLI linked to your project
supabase db push

# Or if you're using local development
supabase migration up
```

### Step 2: Test the Forms

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Test Account Creation:**
   - Navigate to `/create-account`
   - Fill in name and email
   - Submit (check your email for verification link if enabled)

3. **Test Login:**
   - Navigate to `/onboarding-login`
   - Log in with your test account

4. **Test Own Vehicle Form:**
   - Go to `/onboarding`
   - Select "Own Vehicle"
   - Test all 6 pages:
     - Page 1: Personal Details
     - Page 2: Driver's License
     - Page 3: Right to Work
     - Page 4: Vehicle Details
     - Page 5: Identity
     - Page 6: Work Availability
   - Test "Save Progress" button
   - Test navigation (Previous/Next)
   - Test form submission

5. **Test Leased Vehicle Form:**
   - Go to `/onboarding`
   - Select "Leased Vehicle"
   - Test all 6 pages (similar to above)

### Step 3: Verify Data is Saved

1. Check Supabase Dashboard → Table Editor → `onboarding_sessions`
2. Verify all new columns are present
3. Verify data is being saved correctly

## What to Test

- ✅ Form navigation (Previous/Next buttons)
- ✅ Save Progress functionality
- ✅ Required field validation
- ✅ Character limits (maxLength attributes)
- ✅ File uploads (license picture, passport, photo)
- ✅ Dropdown selections (vehicle type, availability)
- ✅ Date pickers (license expiry, passport expiry)
- ✅ Form submission on final page
- ✅ Error handling (try submitting with missing required fields)

## Troubleshooting

**Error: "column does not exist"**
- You haven't run the migration yet. Run it via Supabase Dashboard SQL Editor.

**Error: "rate limit exceeded"**
- The edge function has rate limiting. Wait a few minutes or check the function logs.

**File upload fails**
- Check that the `driver-documents` storage bucket exists and has proper RLS policies.

**Can't log in**
- Check that email verification is configured correctly in Supabase Auth settings.

## Rollback (If Needed)

If you want to remove the new columns:
```sql
-- ⚠️ WARNING: This will delete data in these columns
ALTER TABLE public.onboarding_sessions
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS surname,
DROP COLUMN IF EXISTS address_line_1,
DROP COLUMN IF EXISTS address_line_2,
DROP COLUMN IF EXISTS address_line_3,
DROP COLUMN IF EXISTS post_code,
DROP COLUMN IF EXISTS drivers_license_number,
DROP COLUMN IF EXISTS license_expiry_date,
DROP COLUMN IF EXISTS license_picture,
DROP COLUMN IF EXISTS national_insurance_number,
DROP COLUMN IF EXISTS passport_upload,
DROP COLUMN IF EXISTS passport_number,
DROP COLUMN IF EXISTS passport_expiry_date,
DROP COLUMN IF EXISTS vehicle_registration_number,
DROP COLUMN IF EXISTS vehicle_type,
DROP COLUMN IF EXISTS vehicle_mileage,
DROP COLUMN IF EXISTS leased_vehicle_type1,
DROP COLUMN IF EXISTS leased_vehicle_type2,
DROP COLUMN IF EXISTS leased_vehicle_type3,
DROP COLUMN IF EXISTS photo_upload,
DROP COLUMN IF EXISTS dvla_code,
DROP COLUMN IF EXISTS dbs_check,
DROP COLUMN IF EXISTS driver_availability;
```

