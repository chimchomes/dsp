# Deployment Guide - DSP Application

## 🚀 Vercel Deployment

### Prerequisites

- GitHub repository connected to Vercel
- Supabase project with all migrations applied
- Environment variables ready

### Step 1: Environment Variables

**Critical**: Do NOT include quotes around values in Vercel environment variables.

Set these in Vercel Dashboard → Project Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

**Common Mistake**: Copying from `.env` file with quotes - remove them!

### Step 2: Verify vercel.json

Ensure `vercel.json` exists in project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This enables SPA routing (prevents 404 on refresh).

### Step 3: Deploy

1. Push to `main` branch (auto-deploys)
2. Or manually deploy from Vercel dashboard
3. Wait for build to complete

### Step 4: Post-Deployment Checklist

- [ ] Verify environment variables are set (no quotes)
- [ ] Test login with each role type
- [ ] Verify redirects work correctly
- [ ] Test page refresh (should not 404)
- [ ] Verify real-time features work
- [ ] Check console for errors

## 🗄️ Database Setup

### Migration Order

Apply migrations in chronological order:

1. **Core migrations** (user management, profiles, roles)
2. **Feature migrations** (drivers, routes, expenses)
3. **Policy migrations** (RLS policies)
4. **Recent fixes**:
   - `20251109010000_add_admin_insert_drivers_policy.sql`
   - `20251109020000_backfill_missing_driver_records.sql`

### Required Migrations

**Critical for functionality**:
- `20251108020000_fix_admin_drivers_policy.sql` - Admin access to drivers
- `20251108030000_add_vehicle_fields_to_drivers.sql` - Vehicle fields
- `20251109000000_add_resubmit_status_to_onboarding.sql` - Re-submit status
- `20251109010000_add_admin_insert_drivers_policy.sql` - Admin can create drivers
- `20251109020000_backfill_missing_driver_records.sql` - Fix existing drivers

### Running Migrations

**Option 1: Supabase Dashboard**
1. Go to SQL Editor
2. Copy migration SQL
3. Paste and run
4. Verify success

**Option 2: Supabase CLI**
```bash
supabase db push
```

**Option 3: Manual SQL**
- Copy each migration file
- Run in Supabase SQL Editor
- Check for errors

## 🔧 Edge Functions

Deploy all Edge Functions:

1. `create-staff-account` - Staff account creation
2. `create-onboarding-account` - Onboarding account creation
3. `create-driver-account` - Driver account creation (legacy)
4. `upsert-onboarding-session` - Onboarding form saves
5. `send-notification` - Messaging system
6. `calculate-payout` - Payroll calculations

**Deploy via Supabase CLI**:
```bash
supabase functions deploy create-staff-account
supabase functions deploy create-onboarding-account
# ... etc
```

## ✅ Verification Steps

### 1. Test Authentication

- [ ] Admin can log in → redirects to `/admin`
- [ ] Finance can log in → redirects to `/finance`
- [ ] HR can log in → redirects to `/hr`
- [ ] Dispatcher can log in → redirects to `/dispatcher`
- [ ] Driver can log in → redirects to `/dashboard`
- [ ] Onboarding user can log in → redirects to `/onboarding`

### 2. Test Admin Features

- [ ] Staff Management loads
- [ ] Can create staff account
- [ ] Can edit staff profile
- [ ] Can deactivate/reactivate staff
- [ ] Filtering works (name, role, status)
- [ ] Driver Management loads
- [ ] Can see all drivers
- [ ] Can edit driver profiles
- [ ] Onboarding Applications loads
- [ ] Can approve/reject applications

### 3. Test Onboarding

- [ ] Can create onboarding account
- [ ] Can complete onboarding form
- [ ] Can save progress
- [ ] Can submit application
- [ ] Admin can approve → driver record created
- [ ] Approved driver can log in

### 4. Test Role Access

- [ ] Finance can access `/finance`
- [ ] HR can access `/hr`
- [ ] Dispatcher can access `/dispatcher`
- [ ] Driver can access `/dashboard`
- [ ] Inactive users redirected to `/inbox`

### 5. Test SPA Routing

- [ ] Navigate to `/finance` and refresh → no 404
- [ ] Navigate to `/admin/control-panel` and refresh → no 404
- [ ] Navigate to `/dashboard` and refresh → no 404

## 🐛 Troubleshooting

### 401 Unauthorized

- Check environment variables are set correctly
- Verify no quotes around values
- Check Supabase project URL and keys match

### 404 on Refresh

- Verify `vercel.json` exists
- Check rewrite rules are correct
- Redeploy if needed

### Drivers Not Showing

- Run backfill migration: `20251109020000_backfill_missing_driver_records.sql`
- Check RLS policies allow admin to read drivers
- Verify `user_id` links between tables

### Login Redirects Failing

- Check `user_roles` table has correct roles
- Verify RLS policies allow role queries
- Check browser console for errors
- Verify AuthGuard fallback logic is working

### Staff Deactivation Not Working

- Verify `inactive` role exists in database
- Check RLS policies allow role assignment
- Verify user has staff roles to deactivate

## 📋 Pre-Production Checklist

- [ ] All migrations applied
- [ ] All Edge Functions deployed
- [ ] Environment variables set (no quotes)
- [ ] `vercel.json` present
- [ ] RLS policies verified
- [ ] Test all user roles can log in
- [ ] Test all dashboards accessible
- [ ] Test onboarding workflow end-to-end
- [ ] Test staff management features
- [ ] Test driver management features
- [ ] Verify no console errors
- [ ] Test on mobile device
- [ ] Verify real-time features work

## 🔄 Update Process

### Code Updates

1. Make changes locally
2. Test in development
3. Commit and push to `main`
4. Vercel auto-deploys
5. Verify deployment

### Database Updates

1. Create new migration file
2. Test migration locally
3. Apply to production via Supabase Dashboard
4. Verify migration success
5. Test affected features

### Environment Variable Updates

1. Update in Vercel Dashboard
2. Redeploy (or wait for next deployment)
3. Verify changes take effect

## 📞 Support

If deployment issues occur:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Verify environment variables
4. Check browser console for errors
5. Review migration status in Supabase

