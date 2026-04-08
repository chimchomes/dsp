import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Tenant {
  id: string;
  company_name: string;
  trading_name: string | null;
  company_number: string | null;
  vat_registration_number: string | null;
  primary_email: string;
  primary_phone: string | null;
  website: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  address_line_4: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  logo_url: string | null;
  status: string;
  subscription_plan: string | null;
  max_users: number | null;
  created_at?: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  isLoading: boolean;
  isMasterAdmin: boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  const loadTenantData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTenant(null);
        setIsMasterAdmin(false);
        setIsLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", user.id);

      if (!roles || roles.length === 0) {
        setTenant(null);
        setIsMasterAdmin(false);
        setIsLoading(false);
        return;
      }

      const masterAdmin = roles.some((r: any) => r.role === "master_admin");
      setIsMasterAdmin(masterAdmin);

      if (masterAdmin) {
        setTenant(null);
        setIsLoading(false);
        return;
      }

      const tenantId = roles.find((r: any) => r.tenant_id)?.tenant_id;

      if (tenantId) {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", tenantId)
          .single();

        if (tenantData) {
          setTenant(tenantData as Tenant);
        }
      }
    } catch (error) {
      console.error("Error loading tenant data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenantData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadTenantData();
    });

    return () => subscription.unsubscribe();
  }, [loadTenantData]);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        isLoading,
        isMasterAdmin,
        refreshTenant: loadTenantData,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};
