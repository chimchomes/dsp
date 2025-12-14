# Step-by-Step Testing Guide: Dispatcher & Payroll Features

## Prerequisites
- Supabase project set up
- Admin account with access
- At least one driver account created
- Development server running (`npm run dev`)

---

## Step 1: Apply Database Migrations

### 1.1 Check Migration Files
Verify these migration files exist in `supabase/migrations/`:
- `20251201000000_enhance_dispatcher_account_setup.sql`
- `20251201000001_create_stops_table.sql`
- `20251201000002_add_tour_id_to_routes.sql`
- `20251201000003_link_expenses_to_routes.sql`

### 1.2 Apply Migrations
**Option A: Using Supabase CLI**
```bash
# Navigate to project root
cd DSP

# Apply migrations
supabase db push
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run each migration file in order (00000 → 00001 → 00002 → 00003)
4. Verify no errors

### 1.3 Verify Tables Created
Run this SQL in Supabase SQL Editor:
```sql
-- Check dispatchers table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'dispatchers' 
AND column_name IN ('dsp_name', 'driver_parcel_rate', 'default_deduction_rate', 'tour_id_prefix');

-- Check stops table exists
SELECT * FROM information_schema.tables WHERE table_name = 'stops';

-- Check routes has tour_id
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'routes' AND column_name = 'tour_id';
```

**Expected Result:** All queries should return the expected columns/tables.

---

## Step 2: Deploy Edge Functions

### 2.1 Deploy Route Ingestion Function
```bash
# Using Supabase CLI
supabase functions deploy ingest-route
```

**Or via Supabase Dashboard:**
1. Go to Edge Functions
2. Create new function: `ingest-route`
3. Copy content from `supabase/functions/ingest-route/index.ts`
4. Deploy

### 2.2 Deploy Payslip Generation Function
```bash
supabase functions deploy generate-payslip
```

**Or via Supabase Dashboard:**
1. Create new function: `generate-payslip`
2. Copy content from `supabase/functions/generate-payslip/index.ts`
3. Deploy

### 2.3 Verify Functions
In Supabase Dashboard → Edge Functions, you should see:
- ✅ `ingest-route`
- ✅ `generate-payslip`

---

## Step 3: Test Part 1 - DispatcherAccount Setup

### 3.1 Access Admin Dashboard
1. Log in as Admin user
2. Navigate to `/admin/control-panel`
3. Click on "Dispatchers" tab

### 3.2 Create a New Dispatcher Account
1. Click "Add Dispatcher" button
2. Fill in the form:
   - **Company Name:** `Test Logistics`
   - **DSP Legal Name:** `Test Logistics Ltd`
   - **Contact Email:** `test@logistics.com`
   - **Driver Parcel Rate:** `2.50` (this is the rate per completed parcel)
   - **Default Deduction Rate:** `50.00` (weekly/monthly deduction)
   - **Tour ID Prefix:** `TST_` (for route identification)
   - **Admin Commission %:** `10`
3. Click "Create"

**Expected Result:** 
- Success toast message
- New dispatcher appears in the table
- All fields are visible in the table

### 3.3 Edit Dispatcher Account
1. Click the Edit icon (pencil) on the dispatcher you just created
2. Change Driver Parcel Rate to `3.00`
3. Click "Update"

**Expected Result:**
- Success message
- Table shows updated rate

### 3.4 Verify Data in Database
Run in SQL Editor:
```sql
SELECT dsp_name, driver_parcel_rate, default_deduction_rate, tour_id_prefix 
FROM dispatchers 
WHERE name = 'Test Logistics';
```

**Expected Result:** All fields should show the values you entered.

---

## Step 4: Test Part 2 - Route Ingestion

### 4.1 Create Test CSV File
Create a file `test-route.csv` with this content:
```csv
address,customer_name,package_details
123 Main Street, London, SW1A 1AA,John Smith,Standard Package
456 High Road, Manchester, M1 1AA,Jane Doe,Express Package
789 Park Avenue, Birmingham, B1 1AA,Bob Johnson,Standard Package
```

**Save this file** - you'll upload it in the next step.

### 4.2 Access Route Ingestion Form
1. In Admin Dashboard, go to "Dispatchers" tab
2. Note the ID of your test dispatcher (or use the one you created)
3. Navigate to where RouteIngestionForm is used (check AdminDashboard component)

**Alternative:** If RouteIngestionForm isn't directly accessible:
1. Go to Admin Dashboard → Look for route import option
2. Or navigate to `/admin/control-panel` and find route management

### 4.3 Upload CSV File
1. Click "Import Route" or similar button
2. In the dialog, you should see:
   - File upload section at top
   - Manual entry section below
3. Click "Choose File" and select your `test-route.csv`
4. Verify file name appears
5. Select the dispatcher from dropdown (if available)
6. Set scheduled date to today or tomorrow
7. Click "Import from File"

**Expected Result:**
- Loading spinner appears
- Success message: "Route imported successfully! X stops created, Y geocoded"
- Dialog closes

### 4.4 Verify Route Created
Run in SQL Editor:
```sql
-- Check route was created
SELECT id, tour_id, dispatcher_id, parcel_count_total, scheduled_date 
FROM routes 
WHERE dispatcher_id = (SELECT id FROM dispatchers WHERE name = 'Test Logistics')
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Result:** Route record exists with tour_id starting with `TST_`

### 4.5 Verify Stops Created
```sql
-- Check stops were created
SELECT s.stop_sequence, s.street_address, s.customer_name, 
       s.latitude, s.longitude, s.geocoded
FROM stops s
JOIN routes r ON s.route_id = r.id
WHERE r.tour_id LIKE 'TST_%'
ORDER BY s.stop_sequence;
```

**Expected Result:**
- 3 stops should exist
- Each should have an address
- Latitude/longitude should be populated (if geocoding worked)
- `geocoded` should be `true` for successful geocodes

### 4.6 Test Manual Route Entry (Fallback)
1. Open Route Ingestion Form again
2. Don't select a file
3. Fill in manual fields:
   - Route ID: `TST-MANUAL-001`
   - Scheduled Date: Tomorrow
   - Address: `Test Address`
   - Total Parcels: `10`
   - Rate per Parcel: `2.50`
4. Click "Import Route"

**Expected Result:** Route created without stops (manual entry doesn't create stops)

---

## Step 5: Test Part 3 - Payroll & Payslip Generation

### 5.1 Create Test Data

#### 5.1.1 Create a Route with Completed Parcels
Run in SQL Editor (replace `DRIVER_ID` with actual driver ID):
```sql
-- Get a driver ID first
SELECT id, name FROM drivers LIMIT 1;

-- Create a completed route (replace DRIVER_ID and DISPATCHER_ID)
INSERT INTO routes (
  driver_id, 
  dispatcher_id,
  tour_id,
  customer_name,
  address,
  scheduled_date,
  status,
  parcel_count_total,
  parcels_delivered,
  time_window,
  package_type
) VALUES (
  'DRIVER_ID_HERE',  -- Replace with actual driver ID
  (SELECT id FROM dispatchers WHERE name = 'Test Logistics'),
  'TST-TEST-001',
  'Test Route',
  'Test Address',
  CURRENT_DATE - 7,  -- 7 days ago
  'completed',
  20,
  18,  -- 18 parcels completed
  '09:00-17:00',
  'Standard'
);
```

#### 5.1.2 Create Approved Expenses
```sql
-- Create approved expense (replace DRIVER_ID)
INSERT INTO expenses (
  driver_id,
  cost,
  reason,
  status,
  reviewed_at
) VALUES (
  'DRIVER_ID_HERE',  -- Replace with actual driver ID
  25.50,
  'Fuel expense',
  'approved',
  NOW()
);
```

### 5.2 Test Payslip Generation (Finance Dashboard)

1. Log in as Finance user (or Admin)
2. Navigate to `/finance/payroll`
3. Click on "Generate Payslip" tab
4. Select a driver from dropdown
5. Set period:
   - **Period Start:** 7 days ago
   - **Period End:** Today
6. Click "Generate Payslip"

**Expected Result:**
- Loading spinner
- Payslip card appears showing:
  - Driver details
  - Performance: 18 packages completed, rate £2.50
  - Financial breakdown:
    - Earnings from parcels: £45.00 (18 × £2.50)
    - Approved expenses: £25.50
    - Default deductions: £50.00
    - **Net Pay: £20.50** (45 + 25.50 - 50)

### 5.3 Test Payslip Generation (Driver Portal)

1. Log in as a Driver
2. Navigate to `/earnings`
3. Scroll down to "View Payslip" section
4. Set period:
   - **Period Start:** 7 days ago
   - **Period End:** Today
5. Click "Generate Payslip"

**Expected Result:**
- Payslip shows same data as above
- Driver can see their own payslip
- Print button available

### 5.4 Verify Calculation Logic

The payslip should calculate:
```
Gross Pay = Packages Completed × Driver Parcel Rate
          = 18 × £2.50 = £45.00

Net Pay = Gross Pay + Approved Expenses - Default Deductions
        = £45.00 + £25.50 - £50.00
        = £20.50
```

**Expected Result:** All calculations match the formula above.

### 5.5 Test Edge Cases

#### Test with No Completed Parcels
1. Generate payslip for a driver with no completed routes
2. **Expected:** Gross pay = £0.00, but expenses and deductions still shown

#### Test with No Expenses
1. Generate payslip for period with no approved expenses
2. **Expected:** Expenses = £0.00, but parcels and deductions shown

#### Test with Different Periods
1. Generate payslip for last 30 days
2. Generate payslip for last 7 days
3. **Expected:** Different totals based on date range

---

## Step 6: Integration Testing

### 6.1 Full Workflow Test

1. **Create Dispatcher** (Step 3)
2. **Import Route** (Step 4) - Use CSV upload
3. **Assign Route to Driver:**
   ```sql
   UPDATE routes 
   SET driver_id = 'DRIVER_ID_HERE'
   WHERE tour_id = 'TST-TEST-001';
   ```
4. **Driver Completes Route:**
   ```sql
   UPDATE routes 
   SET status = 'completed', 
       parcels_delivered = 18
   WHERE tour_id = 'TST-TEST-001';
   ```
5. **Driver Submits Expense** (via UI or SQL):
   ```sql
   INSERT INTO expenses (driver_id, cost, reason, status, reviewed_at)
   VALUES ('DRIVER_ID', 30.00, 'Parking', 'approved', NOW());
   ```
6. **Generate Payslip** (Step 5)

**Expected Result:** Complete workflow works end-to-end.

---

## Step 7: Error Handling Tests

### 7.1 Test Invalid CSV
1. Upload a CSV with wrong format
2. **Expected:** Error message explaining format issue

### 7.2 Test Missing Dispatcher
1. Try to import route without selecting dispatcher
2. **Expected:** Error message asking to select dispatcher

### 7.3 Test Invalid Date Range
1. Set period end before period start
2. **Expected:** Validation error or helpful message

### 7.4 Test Geocoding Failures
1. Upload CSV with invalid addresses (e.g., "Invalid Address 12345")
2. **Expected:** Route still created, but stops show `geocoded: false`

---

## Step 8: UI/UX Verification

### 8.1 Check All Forms
- ✅ DispatcherManagement form has all new fields
- ✅ RouteIngestionForm shows file upload section
- ✅ PayslipViewer shows in Finance and Driver portals

### 8.2 Check Tables
- ✅ Dispatcher table shows new columns
- ✅ Routes can be viewed with tour_id
- ✅ Stops can be queried (if you add a stops viewer)

### 8.3 Check Responsiveness
- ✅ Forms work on mobile/tablet
- ✅ Payslip prints correctly
- ✅ Tables are scrollable on small screens

---

## Troubleshooting

### Migration Errors
**Problem:** Migration fails
**Solution:** 
- Check SQL syntax
- Ensure previous migrations ran
- Check for column conflicts

### Edge Function Errors
**Problem:** Function not found or returns error
**Solution:**
- Verify function is deployed
- Check environment variables in Supabase
- Check function logs in Supabase dashboard

### Geocoding Not Working
**Problem:** All addresses show `geocoded: false`
**Solution:**
- Check internet connection
- Nominatim API might be rate-limited
- Consider using Google Maps Geocoding API for production

### Payslip Shows Zero
**Problem:** Payslip shows £0.00 for everything
**Solution:**
- Verify driver has completed routes in date range
- Check `parcels_delivered` is set (not just `parcel_count_total`)
- Verify dispatcher has `driver_parcel_rate` set
- Check date range includes route dates

---

## Success Criteria Checklist

- [ ] All migrations applied successfully
- [ ] Edge functions deployed and accessible
- [ ] Can create dispatcher with all new fields
- [ ] Can edit dispatcher account
- [ ] Can upload CSV and create route with stops
- [ ] Stops are geocoded (at least some addresses)
- [ ] Can generate payslip from Finance dashboard
- [ ] Can generate payslip from Driver portal
- [ ] Payslip calculations are correct
- [ ] Payslip is print-friendly
- [ ] All error cases handled gracefully

---

## Next Steps After Testing

1. **Production Setup:**
   - Replace Nominatim with Google Maps Geocoding API
   - Set up proper error monitoring
   - Configure rate limiting for edge functions

2. **Enhancements:**
   - Add PDF export for payslips
   - Add batch route import
   - Add route assignment UI
   - Add stops viewer on route details page

3. **Documentation:**
   - Document CSV format requirements
   - Create user guides for each role
   - Document API endpoints

---

**Testing Complete!** 🎉

If you encounter any issues during testing, check the browser console and Supabase function logs for detailed error messages.

