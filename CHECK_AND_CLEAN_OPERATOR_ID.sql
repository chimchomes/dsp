-- Check for duplicate operator_id and clean up if needed
-- Run this to see if there's still a driver record with operator_id DB7851

-- Check for any driver records with operator_id DB7851
SELECT id, name, email, operator_id, user_id, active
FROM drivers
WHERE operator_id = 'DB7851';

-- If you see a record above and want to delete it, run this:
-- DELETE FROM drivers WHERE operator_id = 'DB7851';

-- Check for any orphaned driver records (no user_id or user doesn't exist)
SELECT d.id, d.name, d.email, d.operator_id, d.user_id
FROM drivers d
LEFT JOIN auth.users u ON d.user_id = u.id
WHERE u.id IS NULL OR d.user_id IS NULL;

-- To delete orphaned driver records:
-- DELETE FROM drivers 
-- WHERE user_id IS NULL 
--    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = drivers.user_id);
