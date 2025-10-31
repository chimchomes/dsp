-- Create dispatchers table
CREATE TABLE public.dispatchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  rate_per_parcel NUMERIC NOT NULL DEFAULT 0,
  admin_commission_percentage NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on dispatchers
ALTER TABLE public.dispatchers ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage dispatchers
CREATE POLICY "Admins can manage dispatchers"
ON public.dispatchers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow dispatchers to view all dispatchers
CREATE POLICY "Dispatchers can view dispatchers"
ON public.dispatchers
FOR SELECT
USING (has_role(auth.uid(), 'dispatcher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add dispatcher_id to routes table
ALTER TABLE public.routes
ADD COLUMN dispatcher_id UUID REFERENCES public.dispatchers(id);

-- Create trigger for dispatcher updates
CREATE TRIGGER update_dispatchers_updated_at
BEFORE UPDATE ON public.dispatchers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();