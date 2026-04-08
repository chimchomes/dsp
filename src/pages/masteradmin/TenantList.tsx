import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, Eye, Pause, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tenant } from "@/contexts/TenantContext";

interface TenantWithCount extends Tenant {
  user_count?: number;
}

export default function TenantList() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantWithCount[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const tenantsWithCounts: TenantWithCount[] = [];
      for (const t of data || []) {
        const { count } = await supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id);
        tenantsWithCounts.push({ ...t, user_count: count || 0 });
      }
      setTenants(tenantsWithCounts);
    } catch (error) {
      console.error("Error loading tenants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (tenant: TenantWithCount) => {
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    const { error } = await supabase
      .from("tenants")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", tenant.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Updated", description: `${tenant.company_name} is now ${newStatus}.` });
    loadTenants();
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 border-green-200";
      case "suspended": return "bg-red-100 text-red-800 border-red-200";
      case "onboarding": return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "";
    }
  };

  const filtered = tenants.filter(t =>
    t.company_name.toLowerCase().includes(search.toLowerCase()) ||
    t.primary_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AuthGuard requireMasterAdmin>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tenants</h1>
            <p className="text-muted-foreground mt-1">{tenants.length} registered companies</p>
          </div>
          <Button onClick={() => navigate("/masteradmin/tenants/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tenants found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map((tenant) => (
              <Card key={tenant.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {tenant.logo_url ? (
                        <img src={tenant.logo_url} alt="" className="h-8 w-8 object-contain" />
                      ) : (
                        <Building2 className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">{tenant.company_name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{tenant.primary_email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <Badge variant="outline" className={statusColor(tenant.status)}>
                      {tenant.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {tenant.user_count} users
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(tenant.created_at!).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/masteradmin/tenants/${tenant.id}`)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatus(tenant)}
                        title={tenant.status === "active" ? "Suspend" : "Activate"}
                      >
                        {tenant.status === "active" ? (
                          <Pause className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Play className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
