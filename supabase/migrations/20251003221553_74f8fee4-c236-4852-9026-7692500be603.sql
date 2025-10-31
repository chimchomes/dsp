-- Create drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create routes table
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  address TEXT NOT NULL,
  time_window TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  delivery_notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'delayed')),
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  receipt_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create incidents table
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for drivers (drivers can only see their own record)
CREATE POLICY "Drivers can view their own record"
  ON public.drivers FOR SELECT
  USING (email = auth.jwt()->>'email');

-- RLS Policies for routes (drivers can only see their assigned routes)
CREATE POLICY "Drivers can view their own routes"
  ON public.routes FOR SELECT
  USING (driver_id IN (SELECT id FROM public.drivers WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Drivers can update their own routes"
  ON public.routes FOR UPDATE
  USING (driver_id IN (SELECT id FROM public.drivers WHERE email = auth.jwt()->>'email'));

-- RLS Policies for expenses (drivers can only manage their own expenses)
CREATE POLICY "Drivers can view their own expenses"
  ON public.expenses FOR SELECT
  USING (driver_id IN (SELECT id FROM public.drivers WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Drivers can insert their own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE email = auth.jwt()->>'email'));

-- RLS Policies for incidents (drivers can only manage their own incidents)
CREATE POLICY "Drivers can view their own incidents"
  ON public.incidents FOR SELECT
  USING (driver_id IN (SELECT id FROM public.drivers WHERE email = auth.jwt()->>'email'));

CREATE POLICY "Drivers can insert their own incidents"
  ON public.incidents FOR INSERT
  WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE email = auth.jwt()->>'email'));

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add trigger to routes table
CREATE TRIGGER update_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for receipts and incident photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-files', 'delivery-files', false);

-- RLS policies for storage (drivers can upload and access their own files)
CREATE POLICY "Drivers can upload their own files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'delivery-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Drivers can view their own files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'delivery-files' AND auth.uid()::text = (storage.foldername(name))[1]);