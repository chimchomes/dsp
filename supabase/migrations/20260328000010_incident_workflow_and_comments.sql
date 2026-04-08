-- Incident workflow enhancement:
-- - Add status lifecycle for incidents (submitted -> acknowledged -> resolved)
-- - Add admin review metadata
-- - Add incident_comments for threaded updates visible to drivers/admins
-- - Add admin update policy for incidents

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted',
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.incidents
DROP CONSTRAINT IF EXISTS incidents_status_check;

ALTER TABLE public.incidents
ADD CONSTRAINT incidents_status_check
CHECK (status IN ('submitted', 'acknowledged', 'resolved'));

COMMENT ON COLUMN public.incidents.status IS
'Incident workflow status: submitted, acknowledged, resolved';

CREATE TABLE IF NOT EXISTS public.incident_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID REFERENCES auth.users(id),
  commenter_role TEXT NOT NULL DEFAULT 'admin',
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_comments_incident_id
  ON public.incident_comments(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_comments_tenant_id
  ON public.incident_comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incident_comments_created_at
  ON public.incident_comments(created_at DESC);

ALTER TABLE public.incident_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incident_comments_driver_read" ON public.incident_comments;
CREATE POLICY "incident_comments_driver_read" ON public.incident_comments
  FOR SELECT USING (
    is_master_admin()
    OR (
      tenant_id = get_my_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.incidents i
        JOIN public.driver_profiles dp ON dp.id = i.driver_id
        WHERE i.id = incident_comments.incident_id
          AND dp.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "incident_comments_admin_read" ON public.incident_comments;
CREATE POLICY "incident_comments_admin_read" ON public.incident_comments
  FOR SELECT USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

DROP POLICY IF EXISTS "incident_comments_admin_insert" ON public.incident_comments;
CREATE POLICY "incident_comments_admin_insert" ON public.incident_comments
  FOR INSERT WITH CHECK (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );

DROP POLICY IF EXISTS "incidents_admin_update" ON public.incidents;
CREATE POLICY "incidents_admin_update" ON public.incidents
  FOR UPDATE USING (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  )
  WITH CHECK (
    is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role], tenant_id)
  );
