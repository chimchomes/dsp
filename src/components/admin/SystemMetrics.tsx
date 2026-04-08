import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, AlertTriangle, ClipboardCheck, PoundSterling } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenant } from "@/contexts/TenantContext";

interface Metrics {
  totalDrivers: number;
  newOnboarding: number;
  openIncidents: number;
  activeStaff: number;
  ytdProfit: number;
}

const SystemMetrics = () => {
  const { toast } = useToast();
  const { tenant, isLoading: tenantLoading, isMasterAdmin } = useTenant();
  const [metrics, setMetrics] = useState<Metrics>({
    totalDrivers: 0,
    newOnboarding: 0,
    openIncidents: 0,
    activeStaff: 0,
    ytdProfit: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    if (tenantLoading) return;
    if (!isMasterAdmin && !tenant?.id) {
      setLoading(false);
      return;
    }

    try {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
      const endOfYear = new Date(new Date().getFullYear(), 11, 31).toISOString().split("T")[0];

      let driversQuery = supabase
        .from("driver_profiles")
        .select("id", { count: "exact", head: true });
      let onboardingQuery = supabase
        .from("onboarding_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted");
      let incidentsQuery = supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .neq("status", "resolved");
      let staffRolesQuery = supabase
        .from("user_roles")
        .select("user_id, role, tenant_id")
        .in("role", ["admin", "hr", "finance", "inactive"]);
      let invoicesQuery = supabase
        .from("invoices")
        .select("gross_total, invoice_date")
        .gte("invoice_date", startOfYear)
        .lte("invoice_date", endOfYear);
      let payslipsQuery = supabase
        .from("payslips")
        .select("gross_pay, invoice_date")
        .gte("invoice_date", startOfYear)
        .lte("invoice_date", endOfYear);
      let vatExpensesQuery = supabase
        .from("internal_expenses")
        .select("vat_amount, reclaimable_vat, date")
        .gte("date", startOfYear)
        .lte("date", endOfYear);

      if (!isMasterAdmin && tenant?.id) {
        driversQuery = driversQuery.eq("tenant_id", tenant.id);
        onboardingQuery = onboardingQuery.eq("tenant_id", tenant.id);
        incidentsQuery = incidentsQuery.eq("tenant_id", tenant.id);
        staffRolesQuery = staffRolesQuery.eq("tenant_id", tenant.id);
        invoicesQuery = invoicesQuery.eq("tenant_id", tenant.id);
        payslipsQuery = payslipsQuery.eq("tenant_id", tenant.id);
        vatExpensesQuery = vatExpensesQuery.eq("tenant_id", tenant.id);
      }

      const [driversRes, onboardingRes, incidentsRes, staffRolesRes, invoicesRes, payslipsRes, vatExpensesRes] = await Promise.all([
        driversQuery,
        onboardingQuery,
        incidentsQuery,
        staffRolesQuery,
        invoicesQuery,
        payslipsQuery,
        vatExpensesQuery,
      ]);

      const roleRows = staffRolesRes.data || [];
      const staffMap = new Map<string, Set<string>>();
      roleRows.forEach((row: any) => {
        const existing = staffMap.get(row.user_id) || new Set<string>();
        existing.add(row.role);
        staffMap.set(row.user_id, existing);
      });
      const activeStaff = Array.from(staffMap.values()).filter((roles) => {
        const hasStaffRole = roles.has("admin") || roles.has("hr") || roles.has("finance");
        return hasStaffRole && !roles.has("inactive");
      }).length;

      const invoicePaid = (invoicesRes.data || []).reduce(
        (sum: number, row: any) => sum + Number(row.gross_total || 0),
        0
      );
      const driverPaid = (payslipsRes.data || []).reduce(
        (sum: number, row: any) => sum + Number(row.gross_pay || 0),
        0
      );
      const vatPaid = (vatExpensesRes.data || []).reduce(
        (sum: number, row: any) => sum + Number(row.vat_amount || 0),
        0
      );
      const vatClaimed = (vatExpensesRes.data || [])
        .filter((row: any) => !!row.reclaimable_vat)
        .reduce((sum: number, row: any) => sum + Number(row.vat_amount || 0), 0);
      const ytdProfit = invoicePaid - driverPaid - (vatPaid - vatClaimed);

      setMetrics({
        totalDrivers: driversRes.count ?? 0,
        newOnboarding: onboardingRes.count ?? 0,
        openIncidents: incidentsRes.count ?? 0,
        activeStaff,
        ytdProfit,
      });
    } catch (error: any) {
      toast({
        title: "Error fetching metrics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetrics();

    // Refresh metrics every minute
    const interval = setInterval(() => {
      void fetchMetrics();
    }, 60000);

    return () => clearInterval(interval);
  }, [tenant?.id, tenantLoading, isMasterAdmin]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Drivers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalDrivers}</div>
          <p className="text-xs text-muted-foreground">All drivers</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">New Onboarding</CardTitle>
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.newOnboarding}</div>
          <p className="text-xs text-muted-foreground">Submitted applications</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Incidents</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.openIncidents}</div>
          <p className="text-xs text-muted-foreground">Open (not resolved)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.activeStaff}</div>
          <p className="text-xs text-muted-foreground">Active staff members</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Profit (YTD)</CardTitle>
          <PoundSterling className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(metrics.ytdProfit)}</div>
          <p className="text-xs text-muted-foreground">Invoices - payouts - net VAT</p>
        </CardContent>
      </Card>

    </div>
  );
};

export default SystemMetrics;