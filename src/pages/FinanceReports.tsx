import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, TrendingDown, Users, PoundSterling, Package, AlertTriangle, FileText, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { AuthGuard } from "@/components/AuthGuard";
import { DateRange } from "react-day-picker";

interface InsightsData {
  totalRevenue: number;       // net_total from invoices (before VAT)
  totalGrossRevenue: number;  // gross_total from invoices (after VAT)
  totalVAT: number;           // VAT amount
  totalPayouts: number;       // gross_pay from payslips
  netProfit: number;          // revenue - payouts
  profitMargin: number;       // (netProfit / totalRevenue) * 100
  totalAdjustments: number;   // sum of ADJUSTMENT_DETAIL amounts
  adjustmentCount: number;    // number of adjustments
  totalParcels: number;       // total parcels delivered
  invoiceCount: number;       // number of invoices
  payslipCount: number;       // number of payslips generated
}

type DatePreset = "all" | "7d" | "30d" | "this-month" | "last-month" | "ytd" | "custom";

const FinanceReports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeDrivers, setActiveDrivers] = useState(0);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [insights, setInsights] = useState<InsightsData>({
    totalRevenue: 0,
    totalGrossRevenue: 0,
    totalVAT: 0,
    totalPayouts: 0,
    netProfit: 0,
    profitMargin: 0,
    totalAdjustments: 0,
    adjustmentCount: 0,
    totalParcels: 0,
    invoiceCount: 0,
    payslipCount: 0,
  });

  // Get effective date range based on preset or custom selection
  const getEffectiveDateRange = (): { from: Date | null; to: Date | null } => {
    const today = new Date();
    
    switch (datePreset) {
      case "7d":
        return { from: subDays(today, 7), to: today };
      case "30d":
        return { from: subDays(today, 30), to: today };
      case "this-month":
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case "last-month":
        const lastMonth = subMonths(today, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case "ytd":
        return { from: startOfYear(today), to: today };
      case "custom":
        return { from: dateRange?.from || null, to: dateRange?.to || null };
      case "all":
      default:
        return { from: null, to: null };
    }
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      setDateRange(undefined);
    }
  };

  useEffect(() => {
    loadReportsData();

    // Set up realtime subscriptions for dynamic updates
    const channel = supabase
      .channel('finance-insights-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        console.log('Invoices changed, refreshing data...');
        loadReportsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payslips' }, () => {
        console.log('Payslips changed, refreshing data...');
        loadReportsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ADJUSTMENT_DETAIL' }, () => {
        console.log('Adjustments changed, refreshing data...');
        loadReportsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'WEEKLY_PAY' }, () => {
        console.log('Weekly pay changed, refreshing data...');
        loadReportsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_profiles' }, () => {
        console.log('Driver profiles changed, refreshing data...');
        loadReportsData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [datePreset, dateRange]);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      
      const { from, to } = getEffectiveDateRange();
      
      // Build queries with optional date filtering
      let invoicesQuery = supabase.from("invoices").select("net_total, gross_total, vat, invoice_date");
      let payslipsQuery = supabase.from("payslips").select("gross_pay, net_pay, invoice_date");
      let adjustmentsQuery = supabase.from("ADJUSTMENT_DETAIL").select("adjustment_amount, adjustment_date");
      let weeklyPayQuery = supabase.from("WEEKLY_PAY").select("total_qty, invoice_date");
      
      // Apply date filters if set
      if (from) {
        const fromStr = format(from, "yyyy-MM-dd");
        invoicesQuery = invoicesQuery.gte("invoice_date", fromStr);
        payslipsQuery = payslipsQuery.gte("invoice_date", fromStr);
        adjustmentsQuery = adjustmentsQuery.gte("adjustment_date", fromStr);
        weeklyPayQuery = weeklyPayQuery.gte("invoice_date", fromStr);
      }
      if (to) {
        const toStr = format(to, "yyyy-MM-dd");
        invoicesQuery = invoicesQuery.lte("invoice_date", toStr);
        payslipsQuery = payslipsQuery.lte("invoice_date", toStr);
        adjustmentsQuery = adjustmentsQuery.lte("adjustment_date", toStr);
        weeklyPayQuery = weeklyPayQuery.lte("invoice_date", toStr);
      }

      // Parallel fetch all data for insights
      const [
        { data: invoices },
        { data: payslips },
        { data: adjustments },
        { data: weeklyPay },
        { data: drivers },
      ] = await Promise.all([
        invoicesQuery,
        payslipsQuery,
        adjustmentsQuery,
        weeklyPayQuery,
        supabase.from("driver_profiles").select("*").eq("active", true),
      ]);

      // Calculate insights
      // Revenue = net_total (before VAT) - this is the actual revenue
      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.net_total || 0), 0) || 0;
      const totalGrossRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.gross_total || 0), 0) || 0;
      const totalVAT = invoices?.reduce((sum, inv) => sum + Number(inv.vat || 0), 0) || 0;
      
      // Payouts = gross_pay from payslips (what we pay drivers)
      const totalPayouts = payslips?.reduce((sum, ps) => sum + Number(ps.gross_pay || 0), 0) || 0;
      
      // Net Profit = Revenue - Payouts
      const netProfit = totalRevenue - totalPayouts;
      
      // Profit Margin
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      
      // Adjustments (can be positive or negative)
      const totalAdjustments = adjustments?.reduce((sum, adj) => sum + Number(adj.adjustment_amount || 0), 0) || 0;
      
      // Total parcels delivered
      const totalParcels = weeklyPay?.reduce((sum, wp) => sum + Number(wp.total_qty || 0), 0) || 0;

      setInsights({
        totalRevenue,
        totalGrossRevenue,
        totalVAT,
        totalPayouts,
        netProfit,
        profitMargin,
        totalAdjustments,
        adjustmentCount: adjustments?.length || 0,
        totalParcels,
        invoiceCount: invoices?.length || 0,
        payslipCount: payslips?.length || 0,
      });

      // Set active drivers count
      setActiveDrivers(drivers?.length || 0);
    } catch (error) {
      console.error("Error loading reports:", error);
      toast({
        title: "Error",
        description: "Failed to load reports data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeLabel = () => {
    const { from, to } = getEffectiveDateRange();
    if (!from && !to) return "All Time";
    if (from && to) {
      return `${format(from, "dd MMM yyyy")} - ${format(to, "dd MMM yyyy")}`;
    }
    if (from) return `From ${format(from, "dd MMM yyyy")}`;
    if (to) return `Until ${format(to, "dd MMM yyyy")}`;
    return "All Time";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-GB').format(num);
  };

  return (
    <AuthGuard allowedRoles={["route-admin", "admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/finance")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Finance
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Financial Reports</h1>
                <p className="text-muted-foreground mt-1">Real-time financial insights and analytics</p>
              </div>
            </div>
          </div>

          {/* Date Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Period:</span>
                </div>
                
                <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="this-month">This Month</SelectItem>
                    <SelectItem value="last-month">Last Month</SelectItem>
                    <SelectItem value="ytd">Year to Date</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {datePreset === "custom" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="min-w-[240px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd MMM yyyy")} - {format(dateRange.to, "dd MMM yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "dd MMM yyyy")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                )}

                <div className="ml-auto text-sm text-muted-foreground">
                  Showing data for: <span className="font-medium text-foreground">{getDateRangeLabel()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insights Content */}
          <div className="space-y-6">
            {loading ? (
                <div className="flex justify-center p-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* Key Financial Metrics */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-l-4 border-l-emerald-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <PoundSterling className="h-4 w-4 text-emerald-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(insights.totalRevenue)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Net amount (excl. VAT) from {insights.invoiceCount} invoice{insights.invoiceCount !== 1 ? 's' : ''}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-orange-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Payouts</CardTitle>
                        <TrendingDown className="h-4 w-4 text-orange-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                          {formatCurrency(insights.totalPayouts)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Paid to drivers via {insights.payslipCount} payslip{insights.payslipCount !== 1 ? 's' : ''}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className={`border-l-4 ${insights.netProfit >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                        <TrendingUp className={`h-4 w-4 ${insights.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${insights.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(insights.netProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {insights.profitMargin.toFixed(1)}% profit margin
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                        <Users className="h-4 w-4 text-purple-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{activeDrivers}</div>
                        <p className="text-xs text-muted-foreground mt-1">Currently active in system</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Parcels Delivered</CardTitle>
                        <Package className="h-4 w-4 text-cyan-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(insights.totalParcels)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Across all invoices
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Adjustments Impact</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${insights.totalAdjustments >= 0 ? 'text-green-600' : 'text-amber-600'}`} />
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${insights.totalAdjustments >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                          {formatCurrency(insights.totalAdjustments)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {insights.adjustmentCount} adjustment{insights.adjustmentCount !== 1 ? 's' : ''} recorded
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">VAT Collected</CardTitle>
                        <FileText className="h-4 w-4 text-slate-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-slate-600">{formatCurrency(insights.totalVAT)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Gross total: {formatCurrency(insights.totalGrossRevenue)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Profitability Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Profitability Breakdown</CardTitle>
                      <CardDescription>Revenue vs Payouts analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Revenue (Net)</span>
                          <span className="text-sm font-bold text-emerald-600">{formatCurrency(insights.totalRevenue)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
                          <div 
                            className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <span className="text-sm font-medium">Driver Payouts</span>
                          <span className="text-sm font-bold text-orange-600">{formatCurrency(insights.totalPayouts)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
                          <div 
                            className="bg-orange-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: insights.totalRevenue > 0 ? `${Math.min((insights.totalPayouts / insights.totalRevenue) * 100, 100)}%` : '0%' }}
                          />
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                          <span className="text-sm font-medium">Remaining (Net Profit)</span>
                          <span className={`text-sm font-bold ${insights.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(insights.netProfit)}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all duration-500 ${insights.netProfit >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}
                            style={{ width: insights.totalRevenue > 0 ? `${Math.max(Math.min((insights.netProfit / insights.totalRevenue) * 100, 100), 0)}%` : '0%' }}
                          />
                        </div>

                        {insights.totalRevenue > 0 && (
                          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              For every £1.00 of revenue, <span className="font-semibold text-orange-600">{formatCurrency(insights.totalRevenue > 0 ? insights.totalPayouts / insights.totalRevenue : 0)}</span> goes to driver payouts, 
                              leaving <span className={`font-semibold ${insights.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(insights.totalRevenue > 0 ? insights.netProfit / insights.totalRevenue : 0)}</span> as profit.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceReports;
