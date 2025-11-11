# Expected Behavior After Applying Fixes

## Migrations to Apply

You need to apply **2 migrations** to fix the issues:

1. **`20251108020000_fix_admin_drivers_policy.sql`** - Allows admin to read/update all drivers
2. **`20251108030000_add_vehicle_fields_to_drivers.sql`** - Adds missing vehicle and license expiry columns

## What to Expect After Applying Migrations

### 1. Admin Dashboard - Drivers Tab ✅

**Before Fix:**
- Error: "column drivers.license_expiry does not exist"
- Error: "400 Bad Request" in console
- "No drivers found" message displayed

**After Fix:**
- ✅ Drivers table loads successfully
- ✅ All drivers are displayed with:
  - **Name** (from profiles: first_name + surname or full_name)
  - **Email**
  - **Phone** (from profiles)
  - **License** (license_number)
  - **Vehicle** (vehicle_make + vehicle_model + vehicle_year, if available)
  - **Status** (Active/Inactive badge)
  - **Onboarded** (date)
  - **Actions** (Edit button)

**Expected Behavior:**
- If you have drivers in the database, they will appear in the table
- If no drivers exist, you'll see "No drivers found" (this is normal)
- Clicking "Edit" opens a dialog with all driver information

---

### 2. Driver Management - Edit Dialog ✅

**What You'll See:**
- **Personal Information Section:**
  - First Name
  - Surname
  - Email (read-only)
  - Contact Phone
  - Address
  - Emergency Contact Name
  - Emergency Contact Phone

- **Driver-Specific Information Section:**
  - License Number
  - License Expiry (date picker)
  - Vehicle Make
  - Vehicle Model
  - Vehicle Year
  - Vehicle Registration
  - Active Driver (checkbox)

**Expected Behavior:**
- All fields are editable (except email)
- Changes are saved to both `profiles` table (personal info) and `drivers` table (driver-specific info)
- Success toast notification appears after saving
- Table refreshes to show updated information

---

### 3. Admin Dashboard - Exit Button ✅

**What You'll See:**
- **Exit button** in the top-right corner of Admin Dashboard (next to "Admin Control Panel" title)
- Button has a logout icon (LogOut icon)

**Expected Behavior:**
- Clicking "Exit" shows a confirmation dialog:
  - Title: "Confirm Exit"
  - Message: "Are you sure you want to exit? You will be logged out and redirected to the login page."
  - Buttons: "Cancel" and "Yes, Exit"
- Clicking "Yes, Exit":
  - Logs you out
  - Shows toast: "Logged out - You have been logged out successfully"
  - Redirects to `/login` page
- Clicking "Cancel":
  - Closes the dialog
  - Stays on Admin Dashboard

---

### 4. Driver Profile Screen (My Profile) ✅

**What Drivers Will See:**
- **Personal Information Card:**
  - First Name (from profiles)
  - Surname (from profiles)
  - Full Name (from profiles)
  - Email (from profiles)
  - Phone (contact_phone from profiles)
  - Address (from profiles)

- **Emergency Contact Card** (if data exists):
  - Emergency Contact Name
  - Emergency Contact Phone

- **Driver Information Card** (if driver record exists):
  - License Number
  - License Expiry (formatted date)
  - Vehicle (make + model + year)
  - Vehicle Registration

**Expected Behavior:**
- Profile data is read from `profiles` table (matches what admin can edit)
- Driver-specific data (license, vehicle) is read from `drivers` table
- All fields display correctly with proper formatting
- Empty fields are not displayed (cards only show if data exists)

---

### 5. Message Icon - Red Dot Indicator ✅

**What You'll See:**
- **Message icon** (envelope) in the header bar (top-right)
- **Red dot** appears above the message icon when there are unread messages

**Expected Behavior:**
- **Red dot appears** when:
  - User has unread notifications (from `notifications` table where `read_at` is NULL)
- **Red dot disappears** when:
  - All messages are read (all notifications have `read_at` set)
  - User has no unread messages
- **Real-time updates:**
  - Red dot appears immediately when a new message is received
  - Red dot disappears immediately when a message is marked as read
  - Updates happen automatically without page refresh

---

## Console/Network Tab - What Should NOT Appear

### ❌ Errors That Should Be Gone:
- ~~`GET .../rest/v1/drivers?select=... 400 (Bad Request)`~~
- ~~`column drivers.license_expiry does not exist`~~
- ~~`Error code: 42703`~~
- ~~`Failed to load drivers: column drivers.license_expiry does not exist`~~

### ✅ What You Should See Instead:
- Successful API calls: `GET .../rest/v1/drivers?select=... 200 (OK)`
- No error messages in console
- Clean network requests

---

## Testing Checklist

After applying migrations, test the following:

### ✅ Admin Dashboard - Drivers Tab
- [ ] Navigate to Admin Dashboard → Drivers tab
- [ ] Verify drivers table loads without errors
- [ ] Verify all columns display correctly
- [ ] Verify "Edit" button works
- [ ] Verify edit dialog shows all fields
- [ ] Verify saving changes works
- [ ] Verify table refreshes after saving

### ✅ Admin Dashboard - Exit Button
- [ ] Verify "Exit" button appears in header
- [ ] Click "Exit" and verify confirmation dialog appears
- [ ] Click "Cancel" and verify you stay on dashboard
- [ ] Click "Yes, Exit" and verify you're logged out and redirected to login

### ✅ Driver Profile Screen
- [ ] Log in as a driver
- [ ] Navigate to "My Profile"
- [ ] Verify personal information displays correctly
- [ ] Verify driver-specific information displays correctly
- [ ] Verify all fields match what admin can see/edit

### ✅ Message Icon Red Dot
- [ ] Verify red dot appears when you have unread messages
- [ ] Mark a message as read and verify red dot disappears
- [ ] Receive a new message and verify red dot appears immediately
- [ ] Verify red dot disappears when all messages are read

---

## If Something Doesn't Work

### If drivers table still shows errors:
1. Verify migrations were applied successfully
2. Check Supabase dashboard → Database → Tables → `drivers` table
3. Verify columns exist: `license_expiry`, `vehicle_make`, `vehicle_model`, `vehicle_year`, `vehicle_registration`
4. Check browser console for specific error messages
5. Verify you're logged in as an admin user

### If exit button doesn't work:
1. Check browser console for JavaScript errors
2. Verify you're on the Admin Dashboard page
3. Try refreshing the page

### If red dot doesn't appear:
1. Verify you have unread notifications in the `notifications` table
2. Check browser console for errors
3. Verify realtime subscriptions are working (check Network tab)

### If driver profile doesn't show data:
1. Verify driver has a record in `profiles` table
2. Verify driver has a record in `drivers` table (if they're a driver)
3. Check browser console for errors
4. Verify `user_id` matches between `auth.users`, `profiles`, and `drivers` tables

---

## Summary

After applying the migrations, you should see:
- ✅ Drivers table loads successfully in Admin Dashboard
- ✅ All driver information displays correctly
- ✅ Edit functionality works for all fields
- ✅ Exit button works with confirmation
- ✅ Driver profile shows correct information
- ✅ Red dot on message icon appears/disappears based on unread messages
- ✅ No errors in console or network tab

All fixes are backward compatible and won't break existing functionality.

