import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";

interface Invoice {
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
}

interface WeeklyPay {
  invoice_number: string;
  operator_id: string;
  tour: string;
  delivered_qty: number;
  collected_qty: number;
  sacks_qty: number;
  packets_qty: number;
  total_qty: number;
}

interface DriverRate {
  operator_id: string;
  rate: number;
}

interface AdjustmentDetail {
  tour: string | null;
  adjustment_date: string;
  parcel_id: string | null;
  adjustment_type: string;
  adjustment_amount: number;
}

interface DailyPaySummary {
  working_day: string;
  tour: string;
  service_group: string;
  qty_paid: number;
  qty_unpaid: number;
}

const FinanceGeneratePayslip = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_date, period_start, period_end")
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading invoices",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const generatePayslips = async () => {
    if (!selectedInvoice) {
      toast({
        title: "Error",
        description: "Please select an invoice",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const invoice = invoices.find((inv) => inv.invoice_number === selectedInvoice);
      if (!invoice) throw new Error("Invoice not found");

      // Get all unique operator_ids from WEEKLY_PAY for this invoice
      const { data: weeklyPayData, error: weeklyPayError } = await supabase
        .from("WEEKLY_PAY")
        .select("operator_id")
        .eq("invoice_number", selectedInvoice);

      if (weeklyPayError) throw weeklyPayError;

      const operatorIds = [...new Set((weeklyPayData || []).map((wp) => wp.operator_id))];

      if (operatorIds.length === 0) {
        toast({
          title: "No data",
          description: "No weekly pay data found for this invoice",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      const payslipsToInsert = [];

      for (const operatorId of operatorIds) {
        // Get driver info from driver_profiles (single source of truth for drivers)
        const { data: driver, error: driverError } = await supabase
          .from("driver_profiles")
          .select("id, name, email, address, operator_id")
          .eq("operator_id", operatorId)
          .single();

        if (driverError || !driver) {
          console.warn(`Driver not found for operator ${operatorId}`);
          continue;
        }

        // Get weekly pay data for this operator
        const { data: weeklyPay, error: wpError } = await supabase
          .from("WEEKLY_PAY")
          .select("*")
          .eq("invoice_number", selectedInvoice)
          .eq("operator_id", operatorId);

        if (wpError) throw wpError;

        if (!weeklyPay || weeklyPay.length === 0) continue;

        // Aggregate weekly pay data
        const totalDelivered = weeklyPay.reduce((sum, wp) => sum + (wp.delivered_qty || 0), 0);
        const totalCollected = weeklyPay.reduce((sum, wp) => sum + (wp.collected_qty || 0), 0);
        const totalSacks = weeklyPay.reduce((sum, wp) => sum + (wp.sacks_qty || 0), 0);
        const totalPackets = weeklyPay.reduce((sum, wp) => sum + (wp.packets_qty || 0), 0);
        const totalQty = totalDelivered + totalCollected + totalSacks + totalPackets;

        // Get driver rate from driver_rates table using driver_id
        let driverRateValue = 0;
        const { data: driverRates, error: rateError } = await supabase
          .from("driver_rates")
          .select("rate, effective_date")
          .eq("driver_id", driver.id)
          .order("effective_date", { ascending: false })
          .limit(1);

        if (!rateError && driverRates && driverRates.length > 0) {
          driverRateValue = parseFloat(driverRates[0].rate.toString()) || 0;
        } else {
          // Try using operator_id as fallback
          const { data: driverRatesByOp, error: rateError2 } = await supabase
            .from("driver_rates")
            .select("rate, effective_date")
            .eq("operator_id", operatorId)
            .order("effective_date", { ascending: false })
            .limit(1);

          if (!rateError2 && driverRatesByOp && driverRatesByOp.length > 0) {
            driverRateValue = parseFloat(driverRatesByOp[0].rate.toString()) || 0;
          } else {
            console.warn(`No driver rate found for operator ${operatorId} or driver ${driver.id}`);
            continue;
          }
        }

        const grossPay = totalQty * driverRateValue;

        // Get adjustments for this driver/invoice
        const { data: adjustments, error: adjError } = await supabase
          .from("ADJUSTMENT_DETAIL")
          .select("*")
          .eq("invoice_number", selectedInvoice)
          .eq("operator_id", operatorId);

        if (adjError) throw adjError;

        const totalAdjustments = (adjustments || []).reduce(
          (sum, adj) => sum + parseFloat(adj.adjustment_amount.toString()),
          0
        );

        const netPay = grossPay + totalAdjustments;

        // Get daily pay summary
        const { data: dailyPaySummary, error: dpsError } = await supabase
          .from("DAILY_PAY_SUMMARY")
          .select("*")
          .eq("invoice_number", selectedInvoice)
          .eq("operator_id", operatorId)
          .order("working_day", { ascending: true });

        if (dpsError) throw dpsError;

        // Insert payslip
        const payslipData = {
          driver_id: driver.id,
          invoice_number: selectedInvoice,
          invoice_date: invoice.invoice_date,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
          operator_id: operatorId,
          gross_pay: grossPay,
          deductions: 0, // Will be calculated from adjustments if needed
          net_pay: netPay,
          generated_by: (await supabase.auth.getUser()).data.user?.id,
        };

        // Check if payslip already exists
        const { data: existingPayslip } = await supabase
          .from("payslips")
          .select("id")
          .eq("invoice_number", selectedInvoice)
          .eq("driver_id", driver.id)
          .single();

        if (existingPayslip) {
          // Update existing payslip
          const { error: updateError } = await supabase
            .from("payslips")
            .update(payslipData)
            .eq("id", existingPayslip.id);

          if (updateError) throw updateError;
        } else {
          // Insert new payslip
          const { error: insertError } = await supabase.from("payslips").insert([payslipData]);

          if (insertError) throw insertError;
        }
      }

      toast({
        title: "Success",
        description: `Payslips generated successfully for invoice ${selectedInvoice}`,
      });

      navigate("/finance/payslips");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate payslips",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AuthGuard allowedRoles={["admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/finance")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Finance
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Generate Payslips</h1>
              <p className="text-muted-foreground mt-1">Generate payslips per invoice for all drivers</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Select Invoice</CardTitle>
              <CardDescription>Choose an invoice to generate payslips for all drivers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-select">Invoice</Label>
                <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
                  <SelectTrigger id="invoice-select">
                    <SelectValue placeholder="Select an invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((invoice) => (
                      <SelectItem key={invoice.invoice_number} value={invoice.invoice_number}>
                        {invoice.invoice_number} - {new Date(invoice.invoice_date).toLocaleDateString("en-GB")} (
                        {new Date(invoice.period_start).toLocaleDateString("en-GB")} to{" "}
                        {new Date(invoice.period_end).toLocaleDateString("en-GB")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedInvoice && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    This will generate payslips for all drivers who have weekly pay data for invoice{" "}
                    <span className="font-medium">{selectedInvoice}</span>
                  </p>
                </div>
              )}

              <Button
                onClick={generatePayslips}
                disabled={!selectedInvoice || generating}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Payslips...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Payslips
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceGeneratePayslip;
