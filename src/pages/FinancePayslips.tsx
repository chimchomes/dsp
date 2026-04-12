import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { resolveRate } from "@/lib/rateResolver";
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
import { ArrowLeft, FileText, Download, Eye, Filter, Loader2, Receipt, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { useListPagination } from "@/hooks/useListPagination";
import { ListPaginationBar } from "@/components/ListPaginationBar";

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
    national_insurance: string | null;
  };
}

interface Invoice {
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
}

const monthOptions = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const FinancePayslips = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [allPayslips, setAllPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceNumbers, setInvoiceNumbers] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [adjustmentTotals, setAdjustmentTotals] = useState<Record<string, number>>({});
  const [invoicesForGeneration, setInvoicesForGeneration] = useState<Invoice[]>([]);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [selectedInvoiceToGenerate, setSelectedInvoiceToGenerate] = useState("");
  const [generationYearFilters, setGenerationYearFilters] = useState<string[]>([]);
  const [generationMonthFilters, setGenerationMonthFilters] = useState<string[]>([]);
  const [generatingPayslips, setGeneratingPayslips] = useState(false);
  const [generationSearch, setGenerationSearch] = useState("");

  // Filters
  const [invoiceFilter, setInvoiceFilter] = useState<string>("");
  const [driverFilter, setDriverFilter] = useState<string>("");
  const [payslipYearFilters, setPayslipYearFilters] = useState<string[]>([]);
  const [payslipMonthFilters, setPayslipMonthFilters] = useState<string[]>([]);
  const [payslipSearch, setPayslipSearch] = useState("");

  useEffect(() => {
    loadPayslips();
    loadInvoiceNumbers();
    loadDrivers();
    loadInvoicesForGeneration();
  }, []);

  useEffect(() => {
    filterPayslips();
  }, [invoiceFilter, driverFilter, payslipYearFilters, payslipMonthFilters, payslipSearch, allPayslips]);

  const availableGenerationYears = Array.from(
    new Set(
      invoicesForGeneration
        .map((invoice) => {
          const date = new Date(invoice.invoice_date);
          return Number.isNaN(date.getTime()) ? null : String(date.getFullYear());
        })
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => Number(b) - Number(a));

  const generationYearOptions = availableGenerationYears.map((year) => ({
    value: year,
    label: year,
  }));

  const availablePayslipYears = Array.from(
    new Set(
      allPayslips
        .map((payslip) => {
          const date = new Date(payslip.invoice_date);
          return Number.isNaN(date.getTime()) ? null : String(date.getFullYear());
        })
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => Number(b) - Number(a));

  const payslipYearOptions = availablePayslipYears.map((year) => ({
    value: year,
    label: year,
  }));

  const generationInvoices = invoicesForGeneration.filter((invoice) => {
    const date = new Date(invoice.invoice_date);
    if (Number.isNaN(date.getTime())) return false;
    if (
      generationYearFilters.length > 0 &&
      !generationYearFilters.includes(String(date.getFullYear()))
    ) {
      return false;
    }
    if (
      generationMonthFilters.length > 0 &&
      !generationMonthFilters.includes(String(date.getMonth() + 1))
    ) {
      return false;
    }
    if (generationSearch) {
      const term = generationSearch.toLowerCase();
      const invNum = invoice.invoice_number.toLowerCase();
      const invDate = date.toLocaleDateString("en-GB").toLowerCase();
      const periodStart = new Date(invoice.period_start).toLocaleDateString("en-GB").toLowerCase();
      const periodEnd = new Date(invoice.period_end).toLocaleDateString("en-GB").toLowerCase();
      if (!invNum.includes(term) && !invDate.includes(term) && !periodStart.includes(term) && !periodEnd.includes(term)) {
        return false;
      }
    }
    return true;
  });

  useEffect(() => {
    if (!selectedInvoiceToGenerate) return;
    const stillValid = generationInvoices.some((invoice) => invoice.invoice_number === selectedInvoiceToGenerate);
    if (!stillValid) setSelectedInvoiceToGenerate("");
  }, [generationYearFilters, generationMonthFilters, invoicesForGeneration, selectedInvoiceToGenerate]);

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

  const loadInvoicesForGeneration = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_date, period_start, period_end")
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      setInvoicesForGeneration(data || []);
    } catch (error: any) {
      console.error("Error loading generation invoices:", error);
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

    if (payslipYearFilters.length > 0) {
      filtered = filtered.filter((p) => {
        const date = new Date(p.invoice_date);
        if (Number.isNaN(date.getTime())) return false;
        return payslipYearFilters.includes(String(date.getFullYear()));
      });
    }

    if (payslipMonthFilters.length > 0) {
      filtered = filtered.filter((p) => {
        const date = new Date(p.invoice_date);
        if (Number.isNaN(date.getTime())) return false;
        return payslipMonthFilters.includes(String(date.getMonth() + 1));
      });
    }

    if (payslipSearch) {
      const term = payslipSearch.toLowerCase();
      filtered = filtered.filter((p) => {
        const driverName = (p.driver_profiles?.name || "").toLowerCase();
        const invoiceNum = p.invoice_number.toLowerCase();
        const operatorId = (p.operator_id || "").toLowerCase();
        const ni = (p.driver_profiles?.national_insurance || "").toLowerCase();
        const gross = `£${p.gross_pay.toFixed(2)}`;
        const net = `£${p.net_pay.toFixed(2)}`;
        const period = `${new Date(p.period_start).toLocaleDateString("en-GB")} - ${new Date(p.period_end).toLocaleDateString("en-GB")}`;
        return (
          driverName.includes(term) ||
          invoiceNum.includes(term) ||
          operatorId.includes(term) ||
          ni.includes(term) ||
          gross.includes(term) ||
          net.includes(term) ||
          period.toLowerCase().includes(term)
        );
      });
    }

    setPayslips(filtered);
  };

  const payslipsPaginationKey = useMemo(
    () =>
      JSON.stringify({
        invoiceFilter,
        driverFilter,
        payslipYearFilters,
        payslipMonthFilters,
        payslipSearch,
      }),
    [invoiceFilter, driverFilter, payslipYearFilters, payslipMonthFilters, payslipSearch]
  );

  const {
    pageItems: paginatedPayslips,
    page: currentPage,
    totalPages,
    totalItems: payslipsTotal,
    goPrev,
    goNext,
    pageSize,
  } = useListPagination(payslips, payslipsPaginationKey);

  const loadPayslips = async () => {
    try {
      const { data, error } = await supabase
        .from("payslips")
        .select(`
          *,
          driver_profiles (
            name,
            email,
            national_insurance
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

  const generatePayslipsForInvoice = async () => {
    if (!selectedInvoiceToGenerate) {
      toast({
        title: "Error",
        description: "Please select an invoice",
        variant: "destructive",
      });
      return;
    }

    setGeneratingPayslips(true);
    try {
      const invoice = invoicesForGeneration.find((inv) => inv.invoice_number === selectedInvoiceToGenerate);
      if (!invoice) throw new Error("Invoice not found");

      const { data: authData } = await supabase.auth.getUser();
      const generatedByUserId = authData.user?.id;

      const { data: weeklyPayData, error: weeklyPayError } = await supabase
        .from("WEEKLY_PAY")
        .select("operator_id")
        .eq("invoice_number", selectedInvoiceToGenerate);
      if (weeklyPayError) throw weeklyPayError;

      const operatorIds = [...new Set((weeklyPayData || []).map((wp) => wp.operator_id))];
      if (operatorIds.length === 0) {
        toast({
          title: "No data",
          description: "No weekly pay data found for this invoice",
          variant: "destructive",
        });
        return;
      }

      const tenantId = tenant?.id || "";

      for (const operatorId of operatorIds) {
        const { data: driver, error: driverError } = await supabase
          .from("driver_profiles")
          .select("id, operator_id")
          .eq("operator_id", operatorId)
          .single();
        if (driverError || !driver) continue;

        const { data: weeklyPay, error: wpError } = await supabase
          .from("WEEKLY_PAY")
          .select("*")
          .eq("invoice_number", selectedInvoiceToGenerate)
          .eq("operator_id", operatorId);
        if (wpError) throw wpError;
        if (!weeklyPay || weeklyPay.length === 0) continue;

        const asOfDate = invoice.invoice_date;

        // Group quantities by tour for per-tour rate resolution
        const tourQtyMap: Record<string, number> = {};
        for (const wp of weeklyPay) {
          const tour = wp.tour || "UNKNOWN";
          const qty = (wp.delivered_qty || 0) + (wp.collected_qty || 0) + (wp.sacks_qty || 0) + (wp.packets_qty || 0);
          tourQtyMap[tour] = (tourQtyMap[tour] || 0) + qty;
        }

        let grossPay = 0;
        const missingRateTours: string[] = [];

        for (const [tour, qty] of Object.entries(tourQtyMap)) {
          const resolved = await resolveRate(tenantId, driver.id, operatorId, tour, asOfDate);
          if (resolved.rate_source === "none") {
            missingRateTours.push(tour);
            continue;
          }
          grossPay += qty * resolved.applied_rate;
        }

        if (grossPay === 0 && missingRateTours.length > 0) {
          toast({
            title: `No rate found for ${operatorId}`,
            description: `Missing rates for tours: ${missingRateTours.join(", ")}. Assign tour rates or a driver override first.`,
            variant: "destructive",
          });
          continue;
        }

        const { data: adjustments, error: adjError } = await supabase
          .from("ADJUSTMENT_DETAIL")
          .select("adjustment_amount")
          .eq("invoice_number", selectedInvoiceToGenerate)
          .eq("operator_id", operatorId);
        if (adjError) throw adjError;

        const totalAdjustments = (adjustments || []).reduce(
          (sum, adj) => sum + parseFloat(adj.adjustment_amount.toString()),
          0
        );
        const netPay = grossPay + totalAdjustments;

        const payslipData = {
          driver_id: driver.id,
          invoice_number: selectedInvoiceToGenerate,
          invoice_date: invoice.invoice_date,
          period_start: invoice.period_start,
          period_end: invoice.period_end,
          operator_id: operatorId,
          gross_pay: grossPay,
          deductions: 0,
          net_pay: netPay,
          generated_by: generatedByUserId,
        };

        const { data: existingPayslip } = await supabase
          .from("payslips")
          .select("id")
          .eq("invoice_number", selectedInvoiceToGenerate)
          .eq("driver_id", driver.id)
          .maybeSingle();

        if (existingPayslip?.id) {
          const { error: updateError } = await supabase
            .from("payslips")
            .update(payslipData)
            .eq("id", existingPayslip.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from("payslips").insert([payslipData]);
          if (insertError) throw insertError;
        }
      }

      toast({
        title: "Success",
        description: `Payslips generated successfully for invoice ${selectedInvoiceToGenerate}`,
      });

      await Promise.all([loadPayslips(), loadInvoiceNumbers()]);
      setShowGeneratePanel(false);
      setSelectedInvoiceToGenerate("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate payslips",
        variant: "destructive",
      });
    } finally {
      setGeneratingPayslips(false);
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
      ['NI Number', payslip.driver_profiles?.national_insurance || 'N/A'],
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
            <div class="row"><span>NI Number:</span><span>${payslip.driver_profiles?.national_insurance || 'N/A'}</span></div>
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
            <Button onClick={() => setShowGeneratePanel((prev) => !prev)}>
              <Receipt className="w-4 h-4 mr-2" />
              {showGeneratePanel ? "Hide Generator" : "Generate Payslip"}
            </Button>
          </div>

          {showGeneratePanel && (
            <Card>
              <CardHeader>
                <CardTitle>Generate Payslips</CardTitle>
                <CardDescription>
                  Filter invoices by month/year, select an invoice, then generate payslips for drivers on that invoice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices by number, date, or period..."
                    value={generationSearch}
                    onChange={(e) => setGenerationSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="generation-year">Year</Label>
                    <MultiSelect
                      options={generationYearOptions}
                      selected={generationYearFilters}
                      onChange={setGenerationYearFilters}
                      placeholder="All years"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="generation-month">Month</Label>
                    <MultiSelect
                      options={monthOptions}
                      selected={generationMonthFilters}
                      onChange={setGenerationMonthFilters}
                      placeholder="All months"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="generation-invoice">Invoice</Label>
                    <Select value={selectedInvoiceToGenerate} onValueChange={setSelectedInvoiceToGenerate}>
                      <SelectTrigger id="generation-invoice">
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {generationInvoices.map((invoice) => (
                          <SelectItem key={invoice.invoice_number} value={invoice.invoice_number}>
                            {invoice.invoice_number} - {new Date(invoice.invoice_date).toLocaleDateString("en-GB")} (
                            {new Date(invoice.period_start).toLocaleDateString("en-GB")} to{" "}
                            {new Date(invoice.period_end).toLocaleDateString("en-GB")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 flex items-end">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setGenerationYearFilters([]);
                        setGenerationMonthFilters([]);
                        setGenerationSearch("");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={generatePayslipsForInvoice}
                  disabled={!selectedInvoiceToGenerate || generatingPayslips}
                  className="w-full"
                >
                  {generatingPayslips ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Payslips...
                    </>
                  ) : (
                    <>
                      <Receipt className="mr-2 h-4 w-4" />
                      Generate Payslips
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <CardDescription>Filter payslips by invoice number, driver, year, or month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by driver name, invoice, operator ID, NI number, amount..."
                  value={payslipSearch}
                  onChange={(e) => setPayslipSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-5">
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
                  <Label>Year</Label>
                  <MultiSelect
                    options={payslipYearOptions}
                    selected={payslipYearFilters}
                    onChange={setPayslipYearFilters}
                    placeholder="All years"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Month</Label>
                  <MultiSelect
                    options={monthOptions}
                    selected={payslipMonthFilters}
                    onChange={setPayslipMonthFilters}
                    placeholder="All months"
                  />
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
                      setPayslipYearFilters([]);
                      setPayslipMonthFilters([]);
                      setPayslipSearch("");
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
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead>Invoice Number</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Operator ID</TableHead>
                        <TableHead>NI Number</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Adjustments</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPayslips.map((payslip) => (
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
                          <TableCell>{payslip.driver_profiles?.national_insurance || "-"}</TableCell>
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

                  <ListPaginationBar
                    className="mt-4"
                    page={currentPage}
                    totalPages={totalPages}
                    totalItems={payslipsTotal}
                    pageSize={pageSize}
                    onPrev={goPrev}
                    onNext={goNext}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
};

export default FinancePayslips;
