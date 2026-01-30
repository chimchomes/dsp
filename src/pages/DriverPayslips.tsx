import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, Eye, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Payslip {
  id: string;
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
  operator_id: string;
  gross_pay: number;
  deductions: number;
  net_pay: number;
  generated_at: string;
}

const DriverPayslips = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [adjustmentTotals, setAdjustmentTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    loadDriverId();
  }, []);

  useEffect(() => {
    if (driverId) {
      loadPayslips();
    }
  }, [driverId]);

  const loadDriverId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: driver, error } = await supabase
        .from("driver_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setDriverId(driver?.id || null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadPayslips = async () => {
    if (!driverId) return;

    try {
      const { data, error } = await supabase
        .from("payslips")
        .select("*")
        .eq("driver_id", driverId)
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      const payslipData = data || [];
      setPayslips(payslipData);

      await loadAdjustmentTotals(payslipData);
    } catch (error: any) {
      toast({
        title: "Error loading payslips",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAdjustmentTotals = async (payslips: Payslip[]) => {
    try {
      if (!payslips.length) {
        setAdjustmentTotals({});
        return;
      }

      const invoiceNumbers = Array.from(new Set(payslips.map((p) => p.invoice_number)));
      const operatorIds = Array.from(new Set(payslips.map((p) => p.operator_id)));

      const { data, error } = await supabase
        .from("ADJUSTMENT_DETAIL")
        .select("invoice_number, operator_id, adjustment_amount")
        .in("invoice_number", invoiceNumbers)
        .in("operator_id", operatorIds);

      if (error) {
        console.error("Error loading driver adjustment totals:", error);
        return;
      }

      const totals: Record<string, number> = {};

      (data || []).forEach((adj: any) => {
        const key = `${adj.invoice_number}__${adj.operator_id || ""}`;
        const amount = parseFloat(adj.adjustment_amount?.toString() || "0");
        if (!totals[key]) {
          totals[key] = 0;
        }
        totals[key] += isNaN(amount) ? 0 : amount;
      });

      setAdjustmentTotals(totals);
    } catch (err) {
      console.error("Error computing driver adjustment totals:", err);
    }
  };

  const handleViewPayslip = (payslipId: string) => {
    navigate(`/payslips/${payslipId}`);
  };

  return (
    <AuthGuard allowedRoles={["driver"]}>
      <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold">My Payslips</h1>
              <p className="text-muted-foreground mt-1">
                View and download your payslips
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payslips</CardTitle>
            <CardDescription>
              Your payslip history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : payslips.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No payslips found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Payslips will appear here once they are generated by Finance
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Operator ID</TableHead>
                  <TableHead>Gross Pay</TableHead>
                  <TableHead>Adjustments</TableHead>
                    <TableHead>Net Pay</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((payslip) => (
                    <TableRow key={payslip.id}>
                      <TableCell className="font-medium">
                        {payslip.invoice_number}
                      </TableCell>
                      <TableCell>
                        {new Date(payslip.period_start).toLocaleDateString()} -{" "}
                        {new Date(payslip.period_end).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{payslip.operator_id}</TableCell>
                      <TableCell>£{payslip.gross_pay.toFixed(2)}</TableCell>
                      <TableCell>
                        {(() => {
                          const key = `${payslip.invoice_number}__${payslip.operator_id || ""}`;
                          const adjustmentTotal = adjustmentTotals[key] ?? 0;
                          const formatted = `${adjustmentTotal < 0 ? "-" : ""}£${Math.abs(adjustmentTotal).toFixed(2)}`;
                          return (
                            <span className={adjustmentTotal < 0 ? "text-red-600" : adjustmentTotal > 0 ? "text-green-600" : ""}>
                              {formatted}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        £{payslip.net_pay.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPayslip(payslip.id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </AuthGuard>
  );
};

export default DriverPayslips;
