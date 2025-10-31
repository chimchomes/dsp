-- Add additional fields to drivers table for HR management
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS onboarded_by UUID REFERENCES auth.users(id);

-- Create driver_documents table for storing document metadata
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('license', 'proof_of_address', 'right_to_work', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- Create training_items table for defining training checklist items
CREATE TABLE IF NOT EXISTS public.training_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  item_order INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create driver_training_progress table for tracking completion
CREATE TABLE IF NOT EXISTS public.driver_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  training_item_id UUID NOT NULL REFERENCES public.training_items(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(driver_id, training_item_id)
);

-- Enable RLS
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_training_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for driver_documents
CREATE POLICY "Admins can manage all driver documents"
ON public.driver_documents
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view their own documents"
ON public.driver_documents
FOR SELECT
USING (driver_id IN (
  SELECT id FROM public.drivers WHERE email = (auth.jwt() ->> 'email')
));

-- RLS Policies for training_items
CREATE POLICY "Admins can manage training items"
ON public.training_items
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view training items"
ON public.training_items
FOR SELECT
USING (true);

-- RLS Policies for driver_training_progress
CREATE POLICY "Admins can manage all training progress"
ON public.driver_training_progress
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can view their own training progress"
ON public.driver_training_progress
FOR SELECT
USING (driver_id IN (
  SELECT id FROM public.drivers WHERE email = (auth.jwt() ->> 'email')
));

-- Update existing drivers RLS to allow admins to insert/update
CREATE POLICY "Admins can insert drivers"
ON public.drivers
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update drivers"
ON public.drivers
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for driver documents
CREATE POLICY "Admins can upload driver documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents' AND
  has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can view all driver documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'driver-documents' AND
  has_role(auth.uid(), 'admin')
);

CREATE POLICY "Drivers can view their own documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'driver-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.drivers WHERE email = (auth.jwt() ->> 'email')
  )
);

-- Insert some default training items
INSERT INTO public.training_items (title, description, item_order, required)
VALUES
  ('Watch Safety Training Video', 'Complete the 20-minute safety training video covering road safety and vehicle handling', 1, true),
  ('Pass Safety Quiz', 'Score at least 80% on the safety knowledge quiz', 2, true),
  ('Complete Vehicle Inspection Form', 'Learn and complete the daily vehicle inspection checklist', 3, true),
  ('Review Company Policies', 'Read and acknowledge company policies and procedures', 4, true),
  ('Complete First Delivery Shadowing', 'Complete at least one delivery route with an experienced driver', 5, true)
ON CONFLICT DO NOTHING;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_training_progress;