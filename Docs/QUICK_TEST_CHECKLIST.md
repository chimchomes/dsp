# Quick Test Checklist

Use this checklist to quickly test all changes before committing.

## Pre-Testing Setup

- [ ] Backup database (recommended)
- [ ] Apply migration: `20251108040000_update_address_fields_and_inactive_role.sql`
- [ ] Verify migration applied successfully (no errors)
- [ ] Clear browser cache
- [ ] Open browser console to check for errors

---

## Quick Tests (5-10 minutes)

### ✅ Address Fields
- [ ] Staff edit form shows new address fields (4 fields)
- [ ] Driver edit form shows new address fields (4 fields)
- [ ] Can save address data in both forms
- [ ] Profile screen displays address in new format

### ✅ Role Display
- [ ] Staff edit form shows role field (non-editable)
- [ ] Role displays correctly (e.g., "Hr", "Admin")
- [ ] Role updates when changed in User Roles tab

### ✅ Active/Inactive Status
- [ ] Driver edit form has "Active Driver" checkbox
- [ ] Can set driver to inactive
- [ ] Inactive driver redirected to inbox (not dashboard)
- [ ] Inactive driver can message admin
- [ ] Can set driver back to active
- [ ] Active driver can use system normally

### ✅ Exit Button
- [ ] Exit button appears on Admin Dashboard
- [ ] Confirmation dialog appears when clicked
- [ ] Cancel works (stays on dashboard)
- [ ] Confirm works (logs out and redirects to login)

### ✅ Red Dot on Message Icon
- [ ] Red dot appears when unread messages exist
- [ ] Red dot disappears when all messages read
- [ ] Updates in real-time

### ✅ Driver Management
- [ ] Drivers table loads without errors
- [ ] Can edit drivers
- [ ] All fields save correctly
- [ ] Status column shows Active/Inactive

---

## If All Tests Pass ✅

**Commit the changes:**
```bash
git add .
git commit -m "Add address fields, inactive role, and active/inactive status management"
```

---

## If Tests Fail ❌

1. Check browser console for errors
2. Check Supabase logs
3. Verify migration was applied
4. Review error messages
5. Fix issues and test again

---

## Critical Tests (Must Pass)

These tests are critical and must pass:

1. ✅ Migration applies without errors
2. ✅ Address fields save correctly
3. ✅ Active/inactive status works
4. ✅ Inactive users can only access inbox
5. ✅ No errors in browser console
6. ✅ No errors in Supabase logs

If any of these fail, **do not commit** until fixed.

