-- Add RLS policies for delivery-files storage bucket
-- Users can only insert files into their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
CREATE POLICY "Users can view own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins/dispatchers can view all files in delivery-files bucket
CREATE POLICY "Admins can view all delivery files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-files'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'dispatcher'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

-- Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'delivery-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);