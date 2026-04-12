import { useEffect, useState } from "react";
import { useListPagination } from "@/hooks/useListPagination";
import { ListPaginationBar } from "@/components/ListPaginationBar";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Plus } from "lucide-react";

interface TenantSummary {
  id: string;
  company_name: string;
  status: string;
}

export default function MasterAdminDashboard() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data } = await supabase.from("tenants").select("id, company_name, status");
      setTenants(data || []);

      const { count } = await supabase.from("user_roles").select("id", { count: "exact", head: true });
      setUserCount(count || 0);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const active = tenants.filter(t => t.status === "active").length;
  const suspended = tenants.filter(t => t.status === "suspended").length;

  const {
    pageItems: pagedTenants,
    page: dashTenantsPage,
    totalPages: dashTenantsTotalPages,
    totalItems: dashTenantsTotal,
    goPrev: dashTenantsGoPrev,
    goNext: dashTenantsGoNext,
    pageSize: dashTenantsPageSize,
  } = useListPagination(tenants, String(tenants.length));

  return (
    <AuthGuard requireMasterAdmin>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Master Admin</h1>
            <p className="text-muted-foreground mt-1">Manage tenants across the platform</p>
          </div>
          <Button onClick={() => navigate("/masteradmin/tenants/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/masteradmin/tenants")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tenants</CardTitle>
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tenants.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">{active} active, {suspended} suspended</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{userCount}</div>
                </CardContent>
              </Card>
            </div>

            {tenants.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tenants</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pagedTenants.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/masteradmin/tenants/${t.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{t.company_name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          t.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <ListPaginationBar
                    className="mt-4"
                    page={dashTenantsPage}
                    totalPages={dashTenantsTotalPages}
                    totalItems={dashTenantsTotal}
                    pageSize={dashTenantsPageSize}
                    onPrev={dashTenantsGoPrev}
                    onNext={dashTenantsGoNext}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
}
