-- driver_documents is unused; docs live on onboarding_sessions / driver_profiles + driver-documents storage.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.driver_documents;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DROP TABLE IF EXISTS public.driver_documents CASCADE;
