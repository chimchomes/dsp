-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'dispatcher', 'driver');

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Create messages table for dispatcher-driver communication
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "Users can view their messages"
ON public.messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Dispatchers can send messages"
ON public.messages
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their received messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Add package_type to routes table
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS package_type TEXT;

-- Update routes RLS to allow dispatchers to manage all routes
CREATE POLICY "Dispatchers can view all routes"
ON public.routes
FOR SELECT
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Dispatchers can insert routes"
ON public.routes
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Dispatchers can update routes"
ON public.routes
FOR UPDATE
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Dispatchers can delete routes"
ON public.routes
FOR DELETE
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

-- Update drivers RLS to allow dispatchers to view all drivers
CREATE POLICY "Dispatchers can view all drivers"
ON public.drivers
FOR SELECT
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

-- Update incidents RLS to allow dispatchers to view all incidents
CREATE POLICY "Dispatchers can view all incidents"
ON public.incidents
FOR SELECT
USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'admin'));

-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.routes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;