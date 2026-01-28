import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileText, TrendingUp, Users, DollarSign } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DriverRate {
  driver_id: string;
  driver_name: string;
  total_routes: number;
  total_earnings: number;
  avg_per_route: number;
}

const FinanceReports = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [driverRates, setDriverRates] = useState<DriverRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activeDrivers, setActiveDrivers] = useState(0);

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    try {
      // Load driver rates
      const { data: drivers } = await supabase.from("drivers").select("*").eq("active", true);
      
      if (drivers) {
        setActiveDrivers(drivers.length);
        
        const ratesPromises = drivers.map(async (driver) => {
          const { data: earnings } = await supabase
            .from("earnings")
            .select("gross_amount, route_count")
            .eq("driver_id", driver.id);

          const totalEarnings = earnings?.reduce((sum, e) => sum + Number(e.gross_amount), 0) || 0;
          const totalRoutes = earnings?.reduce((sum, e) => sum + Number(e.route_count), 0) || 0;

          return {
            driver_id: driver.id,
            driver_name: driver.name,
            total_routes: totalRoutes,
            total_earnings: totalEarnings,
            avg_per_route: totalRoutes > 0 ? totalEarnings / totalRoutes : 0,
          };
        });

        const rates = await Promise.all(ratesPromises);
        setDriverRates(rates);
        setTotalRevenue(rates.reduce((sum, r) => sum + r.total_earnings, 0));
      }
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

  const exportDriverRates = () => {
    const headers = ["Driver Name", "Total Routes", "Total Earnings", "Avg Per Route"];
    const rows = driverRates.map(d => [
      d.driver_name,
      d.total_routes,
      d.total_earnings.toFixed(2),
      d.avg_per_route.toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `driver-rates-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Driver rates exported to CSV",
    });
  };

  const profitMargin = "100";

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
                <p className="text-muted-foreground mt-1">View invoices, driver rates, and financial analytics</p>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">All-time earnings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">{profitMargin}% margin</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeDrivers}</div>
                <p className="text-xs text-muted-foreground mt-1">Currently active</p>
              </CardContent>
            </Card>
          </div>

          {/* Reports Tabs */}
          <Tabs defaultValue="driver-rates" className="w-full">
            <TabsList>
              <TabsTrigger value="driver-rates">Driver Rates</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="driver-rates" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Driver Performance & Rates</CardTitle>
                      <CardDescription>Earnings breakdown by driver</CardDescription>
                    </div>
                    <Button onClick={exportDriverRates} variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver Name</TableHead>
                          <TableHead className="text-right">Total Routes</TableHead>
                          <TableHead className="text-right">Total Earnings</TableHead>
                          <TableHead className="text-right">Avg Per Route</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {driverRates.map((rate) => (
                          <TableRow key={rate.driver_id}>
                            <TableCell className="font-medium">{rate.driver_name}</TableCell>
                            <TableCell className="text-right">{rate.total_routes}</TableCell>
                            <TableCell className="text-right">${rate.total_earnings.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${rate.avg_per_route.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Management</CardTitle>
                  <CardDescription>Dispatcher and driver invoices</CardDescription>
                </CardHeader>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Invoice management coming soon</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Analytics</CardTitle>
                  <CardDescription>Trends and insights</CardDescription>
                </CardHeader>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Analytics dashboard coming soon</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceReports;
