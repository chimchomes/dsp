-- Tour Rates table: default rate per tour, with effective-date versioning
CREATE TABLE IF NOT EXISTS public.tour_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL DEFAULT get_my_tenant_id() REFERENCES tenants(id),
  tour_id       text NOT NULL,
  rate          numeric(10,2) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id)
);

ALTER TABLE public.tour_rates ENABLE ROW LEVEL SECURITY;

-- Unique constraint: one rate per tour per effective date per tenant
ALTER TABLE public.tour_rates
  ADD CONSTRAINT tour_rates_tenant_tour_effective_unique
  UNIQUE (tenant_id, tour_id, effective_date);

CREATE INDEX idx_tour_rates_tenant_tour ON public.tour_rates (tenant_id, tour_id);
CREATE INDEX idx_tour_rates_tenant_effective ON public.tour_rates (tenant_id, effective_date);

-- RLS: admin and finance can manage tour rates within their tenant
CREATE POLICY "tour_rates_admin_finance" ON public.tour_rates
  USING (is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id))
  WITH CHECK (is_master_admin() OR has_role_in_tenant(ARRAY['admin'::app_role, 'finance'::app_role], tenant_id));

-- RLS: drivers can read tour rates for their own tenant (needed for payslip detail display)
CREATE POLICY "tour_rates_driver_read" ON public.tour_rates
  FOR SELECT
  USING (is_master_admin() OR (tenant_id = get_my_tenant_id()));

-- DB function: resolve the applicable rate for a given driver/tour/date
-- Rule: driver_rates override first, then tour_rates fallback, else NULL
CREATE OR REPLACE FUNCTION public.resolve_rate(
  p_tenant_id uuid,
  p_driver_id uuid,
  p_operator_id text,
  p_tour_id text,
  p_as_of_date date
)
RETURNS TABLE(applied_rate numeric, rate_source text, matched_key text)
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_rate numeric;
  v_source text;
  v_key text;
BEGIN
  -- 1. Try driver_rates override (by driver_id, within tenant, effective_date <= as_of_date)
  SELECT dr.rate INTO v_rate
  FROM public.driver_rates dr
  WHERE dr.tenant_id = p_tenant_id
    AND dr.driver_id = p_driver_id
    AND dr.effective_date <= p_as_of_date
  ORDER BY dr.effective_date DESC
  LIMIT 1;

  IF v_rate IS NOT NULL THEN
    v_source := 'driver_override';
    v_key := p_driver_id::text;
    RETURN QUERY SELECT v_rate, v_source, v_key;
    RETURN;
  END IF;

  -- 1b. Fallback: try driver_rates by operator_id
  SELECT dr.rate INTO v_rate
  FROM public.driver_rates dr
  WHERE dr.tenant_id = p_tenant_id
    AND dr.operator_id = p_operator_id
    AND dr.effective_date <= p_as_of_date
  ORDER BY dr.effective_date DESC
  LIMIT 1;

  IF v_rate IS NOT NULL THEN
    v_source := 'driver_override';
    v_key := p_operator_id;
    RETURN QUERY SELECT v_rate, v_source, v_key;
    RETURN;
  END IF;

  -- 2. Fallback to tour_rates
  SELECT tr.rate INTO v_rate
  FROM public.tour_rates tr
  WHERE tr.tenant_id = p_tenant_id
    AND tr.tour_id = p_tour_id
    AND tr.effective_date <= p_as_of_date
  ORDER BY tr.effective_date DESC
  LIMIT 1;

  IF v_rate IS NOT NULL THEN
    v_source := 'tour_rate';
    v_key := p_tour_id;
    RETURN QUERY SELECT v_rate, v_source, v_key;
    RETURN;
  END IF;

  -- 3. No rate found
  RETURN QUERY SELECT NULL::numeric, 'none'::text, ''::text;
END;
$$;
