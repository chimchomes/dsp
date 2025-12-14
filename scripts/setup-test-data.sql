-- Quick Test Data Setup Script
-- Run this in Supabase SQL Editor after migrations are applied

-- Step 1: Create a test dispatcher (if not exists)
INSERT INTO dispatchers (
  name,
  dsp_name,
  contact_email,
  driver_parcel_rate,
  default_deduction_rate,
  tour_id_prefix,
  admin_commission_percentage,
  active
) VALUES (
  'Test Logistics',
  'Test Logistics Ltd',
  'test@logistics.com',
  2.50,
  50.00,
  'TST_',
  10.00,
  true
) ON CONFLICT DO NOTHING;

-- Step 2: Get a driver ID (replace with your actual driver email)
-- First, find a driver:
SELECT id, name, email FROM drivers LIMIT 1;

-- Step 3: Create a test route with completed parcels
-- Replace 'YOUR_DRIVER_ID' and 'YOUR_DISPATCHER_ID' with actual IDs from above queries
/*
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
  'YOUR_DRIVER_ID',  -- Replace this
  (SELECT id FROM dispatchers WHERE tour_id_prefix = 'TST_'),
  'TST-TEST-001',
  'Test Route for Payslip',
  '123 Test Street, London',
  CURRENT_DATE - 7,  -- 7 days ago
  'completed',
  20,
  18,  -- 18 parcels completed (for testing)
  '09:00-17:00',
  'Standard'
);
*/

-- Step 4: Create test expenses (approved)
-- Replace 'YOUR_DRIVER_ID' with actual driver ID
/*
INSERT INTO expenses (
  driver_id,
  cost,
  reason,
  status,
  reviewed_at
) VALUES 
  ('YOUR_DRIVER_ID', 25.50, 'Fuel expense', 'approved', NOW()),
  ('YOUR_DRIVER_ID', 15.00, 'Parking fee', 'approved', NOW());
*/

-- Step 5: Verify test data
-- Check dispatcher
SELECT id, dsp_name, driver_parcel_rate, default_deduction_rate, tour_id_prefix 
FROM dispatchers 
WHERE tour_id_prefix = 'TST_';

-- Check routes (after inserting)
-- SELECT id, tour_id, parcels_delivered, status, scheduled_date 
-- FROM routes 
-- WHERE tour_id = 'TST-TEST-001';

-- Check expenses (after inserting)
-- SELECT id, cost, reason, status 
-- FROM expenses 
-- WHERE driver_id = 'YOUR_DRIVER_ID' AND status = 'approved';

-- Expected Payslip Calculation:
-- Gross Pay = 18 parcels × £2.50 = £45.00
-- Expenses = £25.50 + £15.00 = £40.50
-- Deductions = £50.00
-- Net Pay = £45.00 + £40.50 - £50.00 = £35.50

