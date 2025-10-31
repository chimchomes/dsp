-- Strengthen onboarding_sessions security

-- Add restrictive authentication requirement to prevent any anonymous access attempts
CREATE POLICY "Onboarding sessions require authentication"
ON public.onboarding_sessions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Create audit logging function for document access
CREATE OR REPLACE FUNCTION public.log_document_access(
  p_session_id uuid,
  p_document_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when sensitive documents are accessed
  PERFORM log_activity(
    'document_accessed',
    'onboarding_session',
    p_session_id,
    jsonb_build_object(
      'document_type', p_document_type,
      'accessed_at', now()
    )
  );
END;
$$;

-- Ensure driver-documents bucket has proper RLS
-- Users can only upload to their own user_id folder
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can only view documents in their own folder
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
CREATE POLICY "Users can view their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all documents for onboarding review
DROP POLICY IF EXISTS "Admins can view all driver documents" ON storage.objects;
CREATE POLICY "Admins can view all driver documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND has_role(auth.uid(), 'admin'::app_role)
);