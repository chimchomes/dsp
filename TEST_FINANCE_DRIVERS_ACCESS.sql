-- Test script to diagnose finance driver access
-- Run this to check if the policy is working

-- 1. Check if finance role exists in app_role enum
SELECT unnest(enum_range(NULL::app_role)) AS role_value;

-- 2. Check current user's roles
SELECT 
  ur.user_id,
  ur.role,
  u.email
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'finance'::app_role;

-- 3. Check if policy exists
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'drivers'
  AND policyname LIKE '%finance%';

-- 4. Test query as current user (should return drivers if policy works)
-- Replace auth.uid() with your actual user ID if testing manually
SELECT 
  id,
  name,
  email,
  operator_id,
  active,
  user_id
FROM public.drivers
WHERE (active = true OR active IS NULL)
LIMIT 10;

-- 5. Check if Barry White exists and is active
SELECT 
  id,
  name,
  email,
  operator_id,
  active
FROM public.drivers
WHERE LOWER(name) LIKE '%barry%white%' 
   OR LOWER(email) LIKE '%barry%white%'
   OR operator_id LIKE '%barry%';
