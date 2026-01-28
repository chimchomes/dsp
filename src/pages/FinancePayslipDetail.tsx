import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { AuthGuard } from "@/components/AuthGuard";

interface Driver {
  id: string;
  name: string;
  email: string;
  address: string | null;
}

interface Payslip {
  id: string;
  driver_id: string;
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

interface WeeklyPay {
  operator_id: string;
  tour: string;
  delivered_qty: number;
  collected_qty: number;
  sacks_qty: number;
  packets_qty: number;
  total_qty: number;
}

interface DailyPaySummary {
  working_day: string;
  tour: string;
  service_group: string;
  qty_paid: number;
  qty_unpaid: number;
  qty_total: number;
  amount_total: number;
}

interface AdjustmentDetail {
  tour: string | null;
  adjustment_date: string;
  parcel_id: string | null;
  adjustment_type: string;
  adjustment_amount: number;
  description: string | null;
}

const FinancePayslipDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [weeklyPay, setWeeklyPay] = useState<WeeklyPay[]>([]);
  const [dailyPaySummary, setDailyPaySummary] = useState<DailyPaySummary[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentDetail[]>([]);
  const [driverRate, setDriverRate] = useState<number>(0);

  useEffect(() => {
    if (id) {
      loadPayslipData();
    }
  }, [id]);

  const loadPayslipData = async () => {
    try {
      setLoading(true);

      // Load payslip
      const { data: payslipData, error: payslipError } = await supabase
        .from("payslips")
        .select("*")
        .eq("id", id)
        .single();

      if (payslipError) throw payslipError;
      if (!payslipData) throw new Error("Payslip not found");

      setPayslip(payslipData);

      // Load driver
      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .select("id, name, email, address")
        .eq("id", payslipData.driver_id)
        .single();

      if (driverError) throw driverError;
      setDriver(driverData);

      // Load driver rate
      const { data: rateData, error: rateError } = await supabase
        .from("driver_rates")
        .select("rate")
        .eq("driver_id", payslipData.driver_id)
        .order("effective_date", { ascending: false })
        .limit(1)
        .single();

      if (!rateError && rateData) {
        setDriverRate(parseFloat(rateData.rate.toString()) || 0);
      } else {
        // Try operator_id as fallback
        const { data: rateData2 } = await supabase
          .from("driver_rates")
          .select("rate")
          .eq("operator_id", payslipData.operator_id)
          .order("effective_date", { ascending: false })
          .limit(1)
          .single();

        if (rateData2) {
          setDriverRate(parseFloat(rateData2.rate.toString()) || 0);
        }
      }

      // Load weekly pay
      const { data: weeklyPayData, error: weeklyPayError } = await supabase
        .from("WEEKLY_PAY")
        .select("*")
        .eq("invoice_number", payslipData.invoice_number)
        .eq("operator_id", payslipData.operator_id);

      if (weeklyPayError) throw weeklyPayError;
      
      // Debug: Log weekly pay data
      console.log("Weekly Pay for operator", payslipData.operator_id, ":", weeklyPayData);
      
      // Filter to ensure we only have data for this operator (double-check)
      const filteredWeeklyPay = (weeklyPayData || []).filter(
        (wp) => wp.operator_id === payslipData.operator_id
      );
      
      console.log("Filtered Weekly Pay:", filteredWeeklyPay);
      
      setWeeklyPay(filteredWeeklyPay);

      // Load daily pay summary - ensure we're getting the correct operator_id
      const { data: dailyPayData, error: dailyPayError } = await supabase
        .from("DAILY_PAY_SUMMARY")
        .select("*")
        .eq("invoice_number", payslipData.invoice_number)
        .eq("operator_id", payslipData.operator_id)
        .order("working_day", { ascending: true })
        .order("tour", { ascending: true });

      if (dailyPayError) throw dailyPayError;
      
      // Debug: Log the data to verify correct extraction
      console.log("Daily Pay Summary for operator", payslipData.operator_id, ":", dailyPayData);
      console.log("Payslip operator_id:", payslipData.operator_id);
      
      // Filter to ensure we only have data for this operator (double-check)
      const filteredDailyPay = (dailyPayData || []).filter(
        (dps) => dps.operator_id === payslipData.operator_id
      );
      
      console.log("Filtered Daily Pay Summary:", filteredDailyPay);
      
      setDailyPaySummary(filteredDailyPay);

      // Load adjustments strictly for this driver on this invoice (no fallback)
      const { data: adjustmentsData, error: adjustmentsError } = await supabase
        .from("ADJUSTMENT_DETAIL")
        .select("*")
        .eq("invoice_number", payslipData.invoice_number)
        .eq("operator_id", payslipData.operator_id)
        .order("adjustment_date", { ascending: true });

      if (adjustmentsError) throw adjustmentsError;
      setAdjustments(adjustmentsData || []);
    } catch (error: any) {
      toast({
        title: "Error loading payslip",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB");
  };

  const generatePayslipPDFContent = (): string => {
    if (!payslip || !driver) return "";

    // Generate HTML table rows for weekly pay
    const weeklyPayRows = weeklyPay.map((wp, idx) => `
      <tr>
        <td>${wp.operator_id}</td>
        <td>${wp.tour}</td>
        <td>${wp.delivered_qty}</td>
        <td>${wp.collected_qty}</td>
        <td>${wp.sacks_qty}</td>
        <td>${wp.packets_qty}</td>
      </tr>
    `).join("");

    // Generate HTML for adjustments
    const adjustmentsRows = adjustments.map((adj, idx) => `
      <tr>
        <td>${adj.tour || "N/A"}</td>
        <td>${formatDate(adj.adjustment_date)}</td>
        <td>${adj.parcel_id || "N/A"}</td>
        <td>${adj.adjustment_type}</td>
        <td style="text-align: right; color: ${adj.adjustment_amount < 0 ? "#dc2626" : "#16a34a"}">
          ${formatCurrency(adj.adjustment_amount)}
        </td>
      </tr>
    `).join("");

    // Generate HTML for daily breakdown
    const dailyBreakdownHTML = Object.values(dailyPayByDay).map((dayGroup, dayIdx) => {
      const dayRows = dayGroup.items.map((item, itemIdx) => {
        // Gross pay per day should only be based on PAID quantities
        // i.e. (QTY Paid) * Driver Rate, NOT including unpaid quantities
        const grossPayPerDay = item.qty_paid * driverRate;
        return `
          <tr>
            <td>${item.service_group}</td>
            <td>${item.qty_paid}</td>
            <td>${item.qty_unpaid}</td>
            <td>${item.qty_total}</td>
            <td>${formatCurrency(driverRate)}</td>
            <td style="text-align: right">${formatCurrency(grossPayPerDay)}</td>
          </tr>
        `;
      }).join("");

      return `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <h3 style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
            Working Day: ${formatDate(dayGroup.working_day)} | Tour: ${dayGroup.tour}
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Service Group</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">QTY Paid</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">QTY Unpaid</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">QTY Total</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Driver Rate</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Gross Pay Per Day</th>
              </tr>
            </thead>
            <tbody>
              ${dayRows}
            </tbody>
          </table>
        </div>
      `;
    }).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${payslip.invoice_number} - ${driver.name}</title>
          <style>
            @media print {
              @page { margin: 1cm; }
              body { margin: 0; }
            }
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              font-size: 12px;
              line-height: 1.6;
            }
            .header { 
              border-bottom: 3px solid #000; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .section { 
              margin-bottom: 30px; 
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 15px;
              border-bottom: 2px solid #333;
              padding-bottom: 5px;
            }
            .row { 
              display: flex; 
              justify-content: space-between; 
              padding: 6px 0; 
              border-bottom: 1px solid #eee; 
            }
            .row-label {
              font-weight: 600;
              color: #666;
            }
            .total { 
              font-weight: bold; 
              font-size: 16px; 
              margin-top: 20px; 
              padding-top: 20px; 
              border-top: 2px solid #000; 
            }
            h1 { margin: 0 0 10px 0; font-size: 24px; }
            h2 { margin: 20px 0 10px 0; font-size: 16px; }
            h3 { margin: 15px 0 10px 0; font-size: 14px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
            }
            .summary-box {
              background-color: #f9fafb;
              padding: 15px;
              border: 2px solid #000;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payslip</h1>
            <div class="row">
              <span class="row-label">Invoice Number:</span>
              <span>${payslip.invoice_number}</span>
            </div>
            <div class="row">
              <span class="row-label">Generated:</span>
              <span>${new Date(payslip.generated_at).toLocaleString("en-GB")}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Driver Details</div>
            <div class="row">
              <span class="row-label">Full Name:</span>
              <span>${driver.name}</span>
            </div>
            <div class="row">
              <span class="row-label">Email:</span>
              <span>${driver.email}</span>
            </div>
            <div class="row">
              <span class="row-label">Address:</span>
              <span>${driver.address || "N/A"}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Invoice Data</div>
            <div class="row">
              <span class="row-label">Invoice Date:</span>
              <span>${formatDate(payslip.invoice_date)}</span>
            </div>
            <div class="row">
              <span class="row-label">Week Start:</span>
              <span>${formatDate(payslip.period_start)}</span>
            </div>
            <div class="row">
              <span class="row-label">Week End:</span>
              <span>${formatDate(payslip.period_end)}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Weekly Pay Summary</div>
            <table>
              <thead>
                <tr>
                  <th>Operator ID</th>
                  <th>Tour</th>
                  <th>Delivered</th>
                  <th>Collected</th>
                  <th>Sacks</th>
                  <th>Packets</th>
                </tr>
              </thead>
              <tbody>
                ${weeklyPayRows}
              </tbody>
            </table>
            <div class="summary-box">
              <div class="row">
                <span class="row-label">Total Delivered:</span>
                <span>${totalDelivered}</span>
              </div>
              <div class="row">
                <span class="row-label">Total Collected:</span>
                <span>${totalCollected}</span>
              </div>
              <div class="row">
                <span class="row-label">Total Sacks:</span>
                <span>${totalSacks}</span>
              </div>
              <div class="row">
                <span class="row-label">Total Packets:</span>
                <span>${totalPackets}</span>
              </div>
              <div class="row total">
                <span>TOTAL:</span>
                <span>${totalQty}</span>
              </div>
              <div class="row">
                <span class="row-label">Driver Rate:</span>
                <span>${formatCurrency(driverRate)}</span>
              </div>
              <div class="row total">
                <span>GROSS PAY:</span>
                <span>${formatCurrency(payslip.gross_pay)}</span>
              </div>
            </div>
          </div>

          ${adjustments.length > 0 ? `
          <div class="section">
            <div class="section-title">Adjustments</div>
            <table>
              <thead>
                <tr>
                  <th>Tour</th>
                  <th>Adjustment Date</th>
                  <th>Parcel ID</th>
                  <th>Type</th>
                  <th style="text-align: right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${adjustmentsRows}
              </tbody>
            </table>
            <div class="row total">
              <span>TOTAL ADJUSTMENTS:</span>
              <span style="color: ${totalAdjustments < 0 ? "#dc2626" : "#16a34a"}">
                ${formatCurrency(totalAdjustments)}
              </span>
            </div>
          </div>
          ` : ""}
          
          <div class="section">
            <div class="section-title">Payment Summary</div>
            <div class="summary-box">
              <div class="row">
                <span class="row-label">Gross Pay:</span>
                <span>${formatCurrency(payslip.gross_pay)}</span>
              </div>
              <div class="row">
                <span class="row-label">Total Adjustments:</span>
                <span style="color: ${totalAdjustments < 0 ? "#dc2626" : totalAdjustments > 0 ? "#16a34a" : "#6b7280"}">
                  ${formatCurrency(totalAdjustments)}
                </span>
              </div>
              <div class="row total" style="font-size: 20px;">
                <span>NET WEEK PAY (£):</span>
                <span>${formatCurrency(payslip.gross_pay + totalAdjustments)}</span>
              </div>
            </div>
          </div>

          ${Object.keys(dailyPayByDay).length > 0 ? `
          <div class="section">
            <div class="section-title">Daily Breakdown Section (For Invoice Period)</div>
            ${dailyBreakdownHTML}
          </div>
          ` : ""}
        </body>
      </html>
    `;
    return htmlContent;
  };

  const downloadPayslipPDF = () => {
    if (!payslip || !driver) {
      toast({
        title: "Error",
        description: "Payslip data not loaded",
        variant: "destructive",
      });
      return;
    }

    const htmlContent = generatePayslipPDFContent();
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        // Small delay to ensure content is rendered
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
  };

  // Calculate totals from weekly pay
  const totalDelivered = weeklyPay.reduce((sum, wp) => sum + (wp.delivered_qty || 0), 0);
  const totalCollected = weeklyPay.reduce((sum, wp) => sum + (wp.collected_qty || 0), 0);
  const totalSacks = weeklyPay.reduce((sum, wp) => sum + (wp.sacks_qty || 0), 0);
  const totalPackets = weeklyPay.reduce((sum, wp) => sum + (wp.packets_qty || 0), 0);
  const totalQty = totalDelivered + totalCollected + totalSacks + totalPackets;
  const totalAdjustments = adjustments.reduce(
    (sum, adj) => sum + parseFloat(adj.adjustment_amount.toString() || "0"),
    0
  );

  // Always compute the displayed net pay from gross + adjustments so the page
  // is correct even if an older payslip row has a stale net_pay value.
  const displayedNetPay = payslip ? payslip.gross_pay + totalAdjustments : 0;

  // Group daily pay summary by working day and tour
  const dailyPayByDay = dailyPaySummary.reduce((acc, dps) => {
    const key = `${dps.working_day}_${dps.tour}`;
    if (!acc[key]) {
      acc[key] = {
        working_day: dps.working_day,
        tour: dps.tour,
        items: [],
      };
    }
    acc[key].items.push(dps);
    return acc;
  }, {} as Record<string, { working_day: string; tour: string; items: DailyPaySummary[] }>);

  if (loading) {
    return (
      <AuthGuard allowedRoles={["admin", "finance", "driver"]}>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto">
            <p className="text-muted-foreground">Loading payslip...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!payslip || !driver) {
    return (
      <AuthGuard allowedRoles={["admin", "finance", "driver"]}>
        <div className="min-h-screen bg-background p-6">
          <div className="max-w-7xl mx-auto">
            <p className="text-muted-foreground">Payslip not found</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard allowedRoles={["admin", "finance", "driver"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => {
                  // If a driver is viewing, send them back to their payslips page
                  // otherwise send finance/admin back to finance payslips
                  navigate(window.location.pathname.startsWith("/finance") ? "/finance/payslips" : "/payslips");
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Payslips
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Payslip Details</h1>
                <p className="text-muted-foreground mt-1">
                  Invoice: {payslip.invoice_number} | Driver: {driver.name}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={downloadPayslipPDF}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Driver Details */}
          <Card>
            <CardHeader>
              <CardTitle>Driver Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{driver.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{driver.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{driver.address || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Data */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{formatDate(payslip.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Week Start</p>
                  <p className="font-medium">{formatDate(payslip.period_start)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Week End</p>
                  <p className="font-medium">{formatDate(payslip.period_end)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Pay Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Pay Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operator ID</TableHead>
                      <TableHead>Tour</TableHead>
                      <TableHead>Delivered</TableHead>
                      <TableHead>Collected</TableHead>
                      <TableHead>Sacks</TableHead>
                      <TableHead>Packets</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyPay.map((wp, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{wp.operator_id}</TableCell>
                        <TableCell>{wp.tour}</TableCell>
                        <TableCell>{wp.delivered_qty}</TableCell>
                        <TableCell>{wp.collected_qty}</TableCell>
                        <TableCell>{wp.sacks_qty}</TableCell>
                        <TableCell>{wp.packets_qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Total Delivered:</span>
                    <span>{totalDelivered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Total Collected:</span>
                    <span>{totalCollected}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Total Sacks:</span>
                    <span>{totalSacks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Total Packets:</span>
                    <span>{totalPackets}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>TOTAL:</span>
                    <span>{totalQty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Driver Rate:</span>
                    <span>{formatCurrency(driverRate)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>GROSS PAY:</span>
                    <span>{formatCurrency(payslip.gross_pay)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Adjustments Summary */}
          {adjustments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Adjustments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Overall total of all manual adjustments applied to this payslip.
                  </p>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total Adjustments:</span>
                    <span className={totalAdjustments < 0 ? "text-red-600" : "text-green-600"}>
                      {formatCurrency(totalAdjustments)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Net Pay */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Gross Pay:</span>
                  <span className="font-medium">{formatCurrency(payslip.gross_pay)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Adjustments:</span>
                  <span
                    className={
                      totalAdjustments < 0
                        ? "text-red-600"
                        : totalAdjustments > 0
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    {formatCurrency(totalAdjustments)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-2xl border-t pt-2">
                  <span>NET WEEK PAY (£):</span>
                  <span>{formatCurrency(displayedNetPay)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown Section */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown Section (For Invoice Period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.values(dailyPayByDay).map((dayGroup, dayIdx) => (
                  <div key={dayIdx} className="space-y-4">
                    <div className="border-b pb-2">
                      <h3 className="font-semibold">
                        Working Day: {formatDate(dayGroup.working_day)} | Tour: {dayGroup.tour}
                      </h3>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service Group</TableHead>
                          <TableHead>QTY Paid</TableHead>
                          <TableHead>QTY Unpaid</TableHead>
                          <TableHead>QTY Total</TableHead>
                          <TableHead>Driver Rate</TableHead>
                          <TableHead className="text-right">Gross Pay Per Day</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayGroup.items.map((item, itemIdx) => {
                          const itemTotal = item.qty_total;
                          // Gross pay per day should only be based on PAID quantities
                          const grossPayPerDay = item.qty_paid * driverRate;
                          return (
                            <TableRow key={itemIdx}>
                              <TableCell>{item.service_group}</TableCell>
                              <TableCell>{item.qty_paid}</TableCell>
                              <TableCell>{item.qty_unpaid}</TableCell>
                              <TableCell>{item.qty_total}</TableCell>
                              <TableCell>{formatCurrency(driverRate)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(grossPayPerDay)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Adjustments Details (if any) */}
          {adjustments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Adjustments Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tour</TableHead>
                      <TableHead>Adjustment Date</TableHead>
                      <TableHead>Parcel ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustments.map((adj, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{adj.tour || "N/A"}</TableCell>
                        <TableCell>{formatDate(adj.adjustment_date)}</TableCell>
                        <TableCell>{adj.parcel_id || "N/A"}</TableCell>
                        <TableCell>{adj.adjustment_type}</TableCell>
                        <TableCell className="text-right">
                          <span className={adj.adjustment_amount < 0 ? "text-red-600" : "text-green-600"}>
                            {formatCurrency(adj.adjustment_amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinancePayslipDetail;
