import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download } from "lucide-react";
import PayrollTable from "@/components/finance/PayrollTable";
import { AuthGuard } from "@/components/AuthGuard";

interface DriverPayroll {
  driver_id: string;
  driver_name: string;
  gross_earnings: number;
  total_deductions: number;
  net_payout: number;
}

const FinancePayroll = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [payrollData, setPayrollData] = useState<DriverPayroll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayrollData();
  }, []);

  const loadPayrollData = async () => {
    try {
      const { data: drivers } = await supabase.from("drivers").select("*");

      if (!drivers) {
        setPayrollData([]);
        return;
      }

      const payrollPromises = drivers.map(async (driver) => {
        const { data: earnings } = await supabase
          .from("earnings")
          .select("gross_amount")
          .eq("driver_id", driver.id);

        const { data: deductions } = await supabase
          .from("deductions")
          .select("amount")
          .eq("driver_id", driver.id);

        const grossEarnings = earnings?.reduce((sum, e) => sum + Number(e.gross_amount), 0) || 0;
        const totalDeductions = deductions?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;

        return {
          driver_id: driver.id,
          driver_name: driver.name,
          gross_earnings: grossEarnings,
          total_deductions: totalDeductions,
          net_payout: grossEarnings - totalDeductions,
        };
      });

      const payroll = await Promise.all(payrollPromises);
      setPayrollData(payroll);
    } catch (error) {
      console.error("Error loading payroll:", error);
      toast({
        title: "Error",
        description: "Failed to load payroll data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Driver Name", "Gross Earnings", "Deductions", "Net Payout"];
    const rows = payrollData.map(d => [
      d.driver_name,
      d.gross_earnings.toFixed(2),
      d.total_deductions.toFixed(2),
      d.net_payout.toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payroll exported to CSV",
    });
  };

  const handleTriggerPayout = async (driverId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("calculate-payout", {
        body: { driver_id: driverId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payout calculated and initiated",
      });

      loadPayrollData();
    } catch (error) {
      console.error("Error triggering payout:", error);
      toast({
        title: "Error",
        description: "Failed to process payout",
        variant: "destructive",
      });
    }
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
                <h1 className="text-3xl font-bold">Payroll Management</h1>
                <p className="text-muted-foreground mt-1">Manage driver payroll and payouts</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          <Card className="p-6">
            <PayrollTable
              data={payrollData}
              loading={loading}
              onTriggerPayout={handleTriggerPayout}
            />
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinancePayroll;
