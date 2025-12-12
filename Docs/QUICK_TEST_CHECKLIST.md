# Quick Test Checklist

## ⚡ 5-Minute Quick Test

### 1. Apply Migrations (2 min)
```bash
supabase db push
```
✅ Check: No errors in console

### 2. Deploy Functions (1 min)
```bash
supabase functions deploy ingest-route
supabase functions deploy generate-payslip
```
✅ Check: Functions appear in Supabase dashboard

### 3. Create Dispatcher (1 min)
1. Go to `/admin/control-panel` → Dispatchers tab
2. Click "Add Dispatcher"
3. Fill:
   - DSP Legal Name: `Test DSP`
   - Driver Parcel Rate: `2.50`
   - Default Deduction: `50.00`
   - Tour Prefix: `TST_`
4. Save
✅ Check: Dispatcher appears in table

### 4. Test Route Import (1 min)
1. Use `test-route.csv` from project root
2. Upload via Route Ingestion Form
3. Select dispatcher
4. Import
✅ Check: Success message with stops count

### 5. Test Payslip (1 min)
1. Go to `/finance/payroll` → "Generate Payslip" tab
2. Select driver
3. Set dates (last 7 days)
4. Generate
✅ Check: Payslip shows with calculations

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Migration fails | Check SQL syntax, run one at a time |
| Function not found | Redeploy, check function name |
| Geocoding fails | Normal for some addresses, check logs |
| Payslip shows £0 | Check driver has completed routes in date range |

---

## 📋 Full Test Guide
See `TESTING_DISPATCHER_PAYROLL_FEATURES.md` for detailed testing steps.
