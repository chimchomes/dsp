-- =============================================================================
-- Must be its own migration (outside any transaction) so the new enum value
-- is committed before any subsequent migration references it.
-- =============================================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master_admin';
