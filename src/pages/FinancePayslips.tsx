import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileText, Download, Eye, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  driver_profiles?: {
    name: string;
    email: string;
  };
}

const FinancePayslips = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [allPayslips, setAllPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceNumbers, setInvoiceNumbers] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [adjustmentTotals, setAdjustmentTotals] = useState<Record<string, number>>({});
  
  // Filters
  const [invoiceFilter, setInvoiceFilter] = useState<string>("");
  const [driverFilter, setDriverFilter] = useState<string>("");

  useEffect(() => {
    loadPayslips();
    loadInvoiceNumbers();
    loadDrivers();
  }, []);

  useEffect(() => {
    filterPayslips();
  }, [invoiceFilter, driverFilter, allPayslips]);

  const loadInvoiceNumbers = async () => {
    try {
      const { data, error } = await supabase
        .from("payslips")
        .select("invoice_number")
        .order("invoice_number", { ascending: false });

      if (error) throw error;
      const uniqueInvoices = [...new Set((data || []).map((p) => p.invoice_number))];
      setInvoiceNumbers(uniqueInvoices);
    } catch (error: any) {
      console.error("Error loading invoice numbers:", error);
    }
  };

  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_profiles")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error: any) {
      console.error("Error loading drivers:", error);
    }
  };

  const filterPayslips = () => {
    let filtered = [...allPayslips];

    if (invoiceFilter) {
      filtered = filtered.filter((p) => p.invoice_number === invoiceFilter);
    }

    if (driverFilter) {
      filtered = filtered.filter((p) => p.driver_id === driverFilter);
    }

    setPayslips(filtered);
  };

  const loadPayslips = async () => {
    try {
      const { data, error } = await supabase
        .from("payslips")
        .select(`
          *,
          driver_profiles (
            name,
            email
          )
        `)
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      const payslipData = data || [];
      setAllPayslips(payslipData);
      setPayslips(payslipData);

      // Load adjustment totals for all fetched payslips so we can show
      // the correct per-driver, per-invoice adjustment figure
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

      const { data, error } = await supabase
        .from("ADJUSTMENT_DETAIL")
        .select("invoice_number, operator_id, adjustment_amount")
        .in("invoice_number", invoiceNumbers);

      if (error) {
        console.error("Error loading adjustment totals:", error);
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
      console.error("Error computing adjustment totals:", err);
    }
  };


  const downloadPayslipPDF = async (payslip: Payslip) => {
    try {
      // Generate PDF content
      const pdfContent = generatePayslipPDFContent(payslip);
      
      // Create blob and download
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Payslip_${payslip.invoice_number}_${payslip.driver_profiles?.name || payslip.driver_id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Payslip downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download payslip",
        variant: "destructive",
      });
    }
  };

  const downloadPayslipCSV = (payslip: Payslip) => {
    const key = `${payslip.invoice_number}__${payslip.operator_id || ""}`;
    const adjustmentTotal = adjustmentTotals[key] ?? 0;
    const csvContent = [
      ['Field', 'Value'],
      ['Driver Name', payslip.driver_profiles?.name || 'N/A'],
      ['Invoice Number', payslip.invoice_number],
      ['Invoice Date', new Date(payslip.invoice_date).toLocaleDateString()],
      ['Period Start', new Date(payslip.period_start).toLocaleDateString()],
      ['Period End', new Date(payslip.period_end).toLocaleDateString()],
      ['Operator ID', payslip.operator_id],
      ['Gross Pay', `£${payslip.gross_pay.toFixed(2)}`],
      ['Adjustments', `£${adjustmentTotal.toFixed(2)}`],
      ['Net Pay', `£${payslip.net_pay.toFixed(2)}`],
      ['Generated At', new Date(payslip.generated_at).toLocaleString()],
    ]
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `Payslip_${payslip.invoice_number}_${payslip.driver_profiles?.name || payslip.driver_id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generatePayslipPDFContent = (payslip: Payslip): string => {
    // Simple HTML-based PDF content (browser will convert to PDF on print)
    // For proper PDF generation, use a library like jsPDF or pdfkit
    const key = `${payslip.invoice_number}__${payslip.operator_id || ""}`;
    const adjustmentTotal = adjustmentTotals[key] ?? 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${payslip.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 30px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .total { font-weight: bold; font-size: 18px; margin-top: 20px; padding-top: 20px; border-top: 2px solid #000; }
            h1 { margin: 0; }
            h2 { margin: 20px 0 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payslip</h1>
            <p>Invoice Number: ${payslip.invoice_number}</p>
            <p>Generated: ${new Date(payslip.generated_at).toLocaleString()}</p>
          </div>
          
          <div class="section">
            <h2>Driver Information</h2>
            <div class="row"><span>Name:</span><span>${payslip.driver_profiles?.name || 'N/A'}</span></div>
            <div class="row"><span>Email:</span><span>${payslip.driver_profiles?.email || 'N/A'}</span></div>
            <div class="row"><span>Operator ID:</span><span>${payslip.operator_id}</span></div>
          </div>
          
          <div class="section">
            <h2>Period</h2>
            <div class="row"><span>Start Date:</span><span>${new Date(payslip.period_start).toLocaleDateString()}</span></div>
            <div class="row"><span>End Date:</span><span>${new Date(payslip.period_end).toLocaleDateString()}</span></div>
            <div class="row"><span>Invoice Date:</span><span>${new Date(payslip.invoice_date).toLocaleDateString()}</span></div>
          </div>
          
          <div class="section">
            <h2>Payment Details</h2>
            <div class="row"><span>Gross Pay:</span><span>£${payslip.gross_pay.toFixed(2)}</span></div>
            <div class="row"><span>Adjustments:</span><span>£${adjustmentTotal.toFixed(2)}</span></div>
            <div class="row total"><span>Net Pay:</span><span>£${payslip.net_pay.toFixed(2)}</span></div>
          </div>
        </body>
      </html>
    `;
    return htmlContent;
  };

  const handleDownloadPDF = async (payslip: Payslip) => {
    const htmlContent = generatePayslipPDFContent(payslip);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <AuthGuard allowedRoles={["admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/finance")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Finance
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Payslips</h1>
                <p className="text-muted-foreground mt-1">
                  View and download payslips for drivers
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <CardDescription>Filter payslips by invoice number or driver</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="invoice-filter">Invoice Number</Label>
                  <Select value={invoiceFilter || "all"} onValueChange={(value) => setInvoiceFilter(value === "all" ? "" : value)}>
                    <SelectTrigger id="invoice-filter">
                      <SelectValue placeholder="All invoices" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All invoices</SelectItem>
                      {invoiceNumbers.map((inv) => (
                        <SelectItem key={inv} value={inv}>
                          {inv}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="driver-filter">Driver</Label>
                  <Select value={driverFilter || "all"} onValueChange={(value) => setDriverFilter(value === "all" ? "" : value)}>
                    <SelectTrigger id="driver-filter">
                      <SelectValue placeholder="All drivers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All drivers</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setInvoiceFilter("");
                      setDriverFilter("");
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payslips</CardTitle>
              <CardDescription>
                {payslips.length} payslip{payslips.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : payslips.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No payslips found</p>
                  <p className="text-sm text-muted-foreground">
                    Upload invoices first, then generate payslips
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
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
                          {payslip.driver_profiles?.name || "N/A"}
                        </TableCell>
                        <TableCell>{payslip.invoice_number}</TableCell>
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
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigate(`/finance/payslips/${payslip.id}`);
                              }}
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadPayslipCSV(payslip)}
                              title="Download CSV"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
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

export default FinancePayslips;
