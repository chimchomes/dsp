import React, { useState } from "react";
import { addQuarters, format, startOfQuarter } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Loader2 } from "lucide-react";

type DriverProfile = {
  id: string;
  name: string | null;
  email: string | null;
  operator_id: string | null;
  created_at: string | null;
  active: boolean | null;
};

type Incident = {
  id: string;
  driver_id: string;
  status: string | null;
  created_at: string | null;
};

type Payslip = {
  driver_id: string;
  operator_id: string | null;
  gross_pay: number | string | null;
  invoice_date: string | null;
};

type WeeklyPay = {
  operator_id: string | null;
  tour: string | null;
  total_qty: number | string | null;
  yodel_weekly_amount: number | string | null;
  invoice_date: string | null;
  invoice_number: string | null;
};

type Invoice = {
  net_total: number | string | null;
  gross_total: number | string | null;
  vat: number | string | null;
  invoice_date: string | null;
};

type InternalExpense = {
  vat_amount: number | string | null;
  reclaimable_vat: boolean | null;
  date: string | null;
  created_at: string | null;
};

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatGBP = (value: number): string =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);

const formatMonthKey = (dateString: string | null | undefined): string => {
  if (!dateString) return "Unknown";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return format(parsed, "yyyy-MM");
};

const formatQuarterKey = (dateString: string | null | undefined): string => {
  if (!dateString) return "Unknown";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  const q = Math.floor(parsed.getMonth() / 3) + 1;
  return `${format(parsed, "yyyy")}-Q${q}`;
};

const sanitizeFilePart = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const ReportsExport = () => {
  const { toast } = useToast();
  const { tenant, isMasterAdmin, isLoading: tenantLoading } = useTenant();
  const [exporting, setExporting] = useState<string | null>(null);

  const requireTenantContext = () => {
    if (!isMasterAdmin && !tenant?.id) {
      throw new Error("Tenant context not available. Please refresh and try again.");
    }
  };

  const buildFilename = (reportType: string) => {
    const companyPart = sanitizeFilePart(tenant?.company_name || "tenant");
    return `${companyPart}-${reportType}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
  };

  const addHeader = (doc: jsPDF, title: string, subtitle: string) => {
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.text(subtitle, 14, 23);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 29);
  };

  const getFirstInvoiceDateForScope = async (): Promise<Date> => {
    let firstInvoiceQuery = supabase
      .from("invoices")
      .select("invoice_date")
      .not("invoice_date", "is", null)
      .order("invoice_date", { ascending: true })
      .limit(1);

    if (!isMasterAdmin && tenant?.id) {
      firstInvoiceQuery = firstInvoiceQuery.eq("tenant_id", tenant.id);
    }

    const { data, error } = await firstInvoiceQuery;
    if (error) throw error;
    const firstDate = data?.[0]?.invoice_date;
    if (!firstDate) {
      throw new Error("No invoices found. Upload at least one invoice before exporting this report.");
    }

    return new Date(firstDate);
  };

  const exportDriverReport = async () => {
    setExporting("driver");
    try {
      requireTenantContext();

      let driversQuery = supabase
        .from("driver_profiles")
        .select("id, name, email, operator_id, created_at, active")
        .eq("active", true)
        .order("name");

      if (!isMasterAdmin && tenant?.id) {
        driversQuery = driversQuery.eq("tenant_id", tenant.id);
      }

      const { data: driversData, error: driversError } = await driversQuery;
      if (driversError) throw driversError;
      const drivers = (driversData || []) as DriverProfile[];
      if (drivers.length === 0) throw new Error("No active drivers found for this tenant.");

      const driverIds = drivers.map((d) => d.id);
      const operatorIds = Array.from(new Set(drivers.map((d) => d.operator_id).filter(Boolean) as string[]));
      const operatorToDriver = new Map<string, string>();
      drivers.forEach((driver) => {
        if (driver.operator_id) operatorToDriver.set(driver.operator_id, driver.id);
      });

      let incidentsQuery = supabase
        .from("incidents")
        .select("id, driver_id, status, created_at")
        .in("driver_id", driverIds);
      let payslipsQuery = supabase
        .from("payslips")
        .select("driver_id, operator_id, gross_pay, invoice_date")
        .in("driver_id", driverIds);
      let weeklyPayQuery = supabase
        .from("WEEKLY_PAY")
        .select("operator_id, tour, total_qty, yodel_weekly_amount, invoice_date, invoice_number")
        .in("operator_id", operatorIds);

      if (!isMasterAdmin && tenant?.id) {
        incidentsQuery = incidentsQuery.eq("tenant_id", tenant.id);
        payslipsQuery = payslipsQuery.eq("tenant_id", tenant.id);
        weeklyPayQuery = weeklyPayQuery.eq("tenant_id", tenant.id);
      }

      const [
        { data: incidentsData, error: incidentsError },
        { data: payslipsData, error: payslipsError },
        { data: weeklyPayData, error: weeklyPayError },
      ] = await Promise.all([incidentsQuery, payslipsQuery, weeklyPayQuery]);
      if (incidentsError) throw incidentsError;
      if (payslipsError) throw payslipsError;
      if (weeklyPayError) throw weeklyPayError;

      const incidents = (incidentsData || []) as Incident[];
      const payslips = (payslipsData || []) as Payslip[];
      const weeklyPayRows = (weeklyPayData || []) as WeeklyPay[];

      const payByDriverId = new Map<string, number>();
      const payByOperatorId = new Map<string, number>();
      payslips.forEach((pay) => {
        payByDriverId.set(pay.driver_id, (payByDriverId.get(pay.driver_id) || 0) + toNumber(pay.gross_pay));
        if (pay.operator_id) {
          payByOperatorId.set(pay.operator_id, (payByOperatorId.get(pay.operator_id) || 0) + toNumber(pay.gross_pay));
        }
      });

      const driverRevenue = new Map<string, number>();
      const driverTours = new Map<string, Set<string>>();
      const driverParcels = new Map<string, number>();
      weeklyPayRows.forEach((row) => {
        if (!row.operator_id) return;
        const driverId = operatorToDriver.get(row.operator_id);
        if (!driverId) return;

        driverRevenue.set(driverId, (driverRevenue.get(driverId) || 0) + toNumber(row.yodel_weekly_amount));

        const tourSet = driverTours.get(driverId) || new Set<string>();
        if (row.tour) tourSet.add(row.tour);
        driverTours.set(driverId, tourSet);

        driverParcels.set(driverId, (driverParcels.get(driverId) || 0) + toNumber(row.total_qty));
      });

      const incidentsByDriver = new Map<string, Incident[]>();
      incidents.forEach((incident) => {
        const items = incidentsByDriver.get(incident.driver_id) || [];
        items.push(incident);
        incidentsByDriver.set(incident.driver_id, items);
      });

      const rows = drivers.map((driver) => {
        const driverIncidents = incidentsByDriver.get(driver.id) || [];
        const submitted = driverIncidents.filter((i) => i.status === "submitted").length;
        const acknowledged = driverIncidents.filter((i) => i.status === "acknowledged").length;
        const resolved = driverIncidents.filter((i) => i.status === "resolved").length;

        const pay = driver.operator_id
          ? (payByOperatorId.get(driver.operator_id) || 0)
          : (payByDriverId.get(driver.id) || 0);
        const revenue = driverRevenue.get(driver.id) || 0;
        const parcels = driverParcels.get(driver.id) || 0;
        const profitGenerated = revenue - pay;

        return [
          driver.name || "Unknown",
          driver.email || "-",
          driver.operator_id || "-",
          driver.created_at ? format(new Date(driver.created_at), "dd MMM yyyy") : "-",
          `${(driverTours.get(driver.id) || new Set()).size}`,
          `${submitted}/${acknowledged}/${resolved}`,
          parcels.toLocaleString("en-GB"),
          formatGBP(pay),
          formatGBP(revenue),
          formatGBP(profitGenerated),
        ];
      });

      const doc = new jsPDF({ orientation: "landscape" });
      addHeader(
        doc,
        "Driver Report",
        `${tenant?.company_name || "Tenant"} - active drivers with incidents, tours, pay and driver profit`
      );
      autoTable(doc, {
        startY: 34,
        head: [[
          "Driver",
          "Email",
          "Operator ID",
          "Date Joined",
          "Tours Worked",
          "Incidents (S/A/R)",
          "Parcels",
          "Total Pay",
          "Revenue Attributed",
          "Profit Generated",
        ]],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [31, 41, 55] },
      });
      doc.save(buildFilename("driver-report"));

      toast({
        title: "Driver report exported",
        description: `Exported ${drivers.length} active drivers.`,
      });
    } catch (error: any) {
      toast({
        title: "Driver report failed",
        description: error.message || "Unable to export driver report.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportProfitReport = async () => {
    setExporting("profit");
    try {
      requireTenantContext();

      const firstInvoiceDate = await getFirstInvoiceDateForScope();
      const startDate = format(firstInvoiceDate, "yyyy-MM-dd");

      let invoicesQuery = supabase
        .from("invoices")
        .select("net_total, invoice_date")
        .gte("invoice_date", startDate);
      let payslipsQuery = supabase
        .from("payslips")
        .select("gross_pay, invoice_date")
        .gte("invoice_date", startDate);

      if (!isMasterAdmin && tenant?.id) {
        invoicesQuery = invoicesQuery.eq("tenant_id", tenant.id);
        payslipsQuery = payslipsQuery.eq("tenant_id", tenant.id);
      }

      const [{ data: invoicesData, error: invoicesError }, { data: payslipsData, error: payslipsError }] =
        await Promise.all([invoicesQuery, payslipsQuery]);
      if (invoicesError) throw invoicesError;
      if (payslipsError) throw payslipsError;

      const invoices = (invoicesData || []) as Invoice[];
      const payslips = (payslipsData || []) as Payslip[];

      const monthSummary = new Map<string, { revenue: number; payouts: number }>();

      const ensureMonth = (monthKey: string) => {
        if (!monthSummary.has(monthKey)) {
          monthSummary.set(monthKey, { revenue: 0, payouts: 0 });
        }
        return monthSummary.get(monthKey)!;
      };

      invoices.forEach((invoice) => {
        const monthKey = formatMonthKey(invoice.invoice_date);
        const item = ensureMonth(monthKey);
        item.revenue += toNumber(invoice.net_total);
      });

      payslips.forEach((payslip) => {
        const monthKey = formatMonthKey(payslip.invoice_date);
        const item = ensureMonth(monthKey);
        item.payouts += toNumber(payslip.gross_pay);
      });

      const rows = Array.from(monthSummary.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, item]) => {
          const profit = item.revenue - item.payouts;
          return [month, formatGBP(item.revenue), formatGBP(item.payouts), formatGBP(profit)];
        });

      if (rows.length === 0) throw new Error("No finance data found for profit report.");

      const ytdTotals = rows.reduce(
        (acc, row) => {
          acc.revenue += toNumber(String(row[1]).replace(/[^\d.-]/g, ""));
          acc.payouts += toNumber(String(row[2]).replace(/[^\d.-]/g, ""));
          acc.profit += toNumber(String(row[3]).replace(/[^\d.-]/g, ""));
          return acc;
        },
        { revenue: 0, payouts: 0, profit: 0 }
      );

      const doc = new jsPDF({ orientation: "landscape" });
      addHeader(
        doc,
        "Profit Report",
        `${tenant?.company_name || "Tenant"} - monthly net profit from first invoice (${format(firstInvoiceDate, "dd MMM yyyy")})`
      );
      autoTable(doc, {
        startY: 34,
        head: [["Month", "Net Revenue", "Driver Pay", "Profit"]],
        body: rows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [31, 41, 55] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["Total Net Revenue", "Total Driver Pay", "Total Profit"]],
        body: [[
          formatGBP(ytdTotals.revenue),
          formatGBP(ytdTotals.payouts),
          formatGBP(ytdTotals.profit),
        ]],
        styles: { fontSize: 10, fontStyle: "bold" },
        headStyles: { fillColor: [17, 24, 39] },
      });
      doc.save(buildFilename("profit-report"));

      toast({
        title: "Profit report exported",
        description: "Exported monthly profit report from first invoice date.",
      });
    } catch (error: any) {
      toast({
        title: "Profit report failed",
        description: error.message || "Unable to export profit report.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportVatReport = async () => {
    setExporting("vat");
    try {
      requireTenantContext();

      const firstInvoiceDate = await getFirstInvoiceDateForScope();
      const startDate = format(firstInvoiceDate, "yyyy-MM-dd");
      const exportDate = new Date();
      const startQuarterDate = startOfQuarter(firstInvoiceDate);

      let invoicesQuery = supabase
        .from("invoices")
        .select("vat, invoice_date")
        .gte("invoice_date", startDate);
      let expensesQuery = supabase
        .from("internal_expenses")
        .select("vat_amount, reclaimable_vat, date, created_at");

      if (!isMasterAdmin && tenant?.id) {
        invoicesQuery = invoicesQuery.eq("tenant_id", tenant.id);
        expensesQuery = expensesQuery.eq("tenant_id", tenant.id);
      }

      const [{ data: invoicesData, error: invoicesError }, { data: expensesData, error: expensesError }] = await Promise.all([
        invoicesQuery,
        expensesQuery,
      ]);
      if (invoicesError) throw invoicesError;
      if (expensesError) throw expensesError;

      const invoices = (invoicesData || []) as Invoice[];
      const expenses = (expensesData || []) as InternalExpense[];

      const quarterSummary = new Map<string, { vatReceived: number; vatClaimed: number }>();
      const ensureQuarter = (quarterKey: string) => {
        if (!quarterSummary.has(quarterKey)) quarterSummary.set(quarterKey, { vatReceived: 0, vatClaimed: 0 });
        return quarterSummary.get(quarterKey)!;
      };

      invoices.forEach((invoice) => {
        const quarterKey = formatQuarterKey(invoice.invoice_date);
        if (quarterKey === "Unknown") return;
        const item = ensureQuarter(quarterKey);
        item.vatReceived += toNumber(invoice.vat);
      });

      expenses.forEach((expense) => {
        if (!expense.reclaimable_vat) return;
        const dateValue = expense.date || expense.created_at;
        const quarterKey = formatQuarterKey(dateValue);
        if (quarterKey === "Unknown") return;
        const item = ensureQuarter(quarterKey);
        item.vatClaimed += toNumber(expense.vat_amount);
      });

      const quarterKeys: string[] = [];
      let cursor = startQuarterDate;
      while (cursor <= exportDate) {
        quarterKeys.push(formatQuarterKey(cursor.toISOString()));
        cursor = addQuarters(cursor, 1);
      }

      const rows = quarterKeys.map((quarterKey) => {
          const item = quarterSummary.get(quarterKey) || { vatReceived: 0, vatClaimed: 0 };
          const vatToPay = item.vatReceived - item.vatClaimed;
          return [quarterKey, formatGBP(item.vatReceived), formatGBP(item.vatClaimed), formatGBP(vatToPay)];
        });

      const doc = new jsPDF({ orientation: "landscape" });
      addHeader(
        doc,
        "VAT Report",
        `${tenant?.company_name || "Tenant"} - quarterly VAT from first invoice (${format(firstInvoiceDate, "dd MMM yyyy")})`
      );
      autoTable(doc, {
        startY: 34,
        head: [["Quarter", "VAT Received", "VAT Claimed", "VAT Needed to Pay"]],
        body: rows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [31, 41, 55] },
      });
      doc.save(buildFilename("vat-report"));

      toast({
        title: "VAT report exported",
        description: "Exported quarterly VAT report from first invoice quarter to export date.",
      });
    } catch (error: any) {
      toast({
        title: "VAT report failed",
        description: error.message || "Unable to export VAT report.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const exportTourReport = async () => {
    setExporting("tour");
    try {
      requireTenantContext();

      let driversQuery = supabase.from("driver_profiles").select("id, operator_id");
      if (!isMasterAdmin && tenant?.id) {
        driversQuery = driversQuery.eq("tenant_id", tenant.id);
      }
      const { data: driversData, error: driversError } = await driversQuery;
      if (driversError) throw driversError;

      const operatorIds = Array.from(
        new Set((driversData || []).map((d: any) => d.operator_id).filter(Boolean) as string[])
      );
      if (operatorIds.length === 0) throw new Error("No operator IDs found for this tenant.");

      const { data: weeklyPayData, error: weeklyPayError } = await supabase
        .from("WEEKLY_PAY")
        .select("tour, total_qty, yodel_weekly_amount, operator_id, invoice_number")
        .in("operator_id", operatorIds);
      if (weeklyPayError) throw weeklyPayError;

      const weeklyPayRows = (weeklyPayData || []) as WeeklyPay[];
      if (weeklyPayRows.length === 0) throw new Error("No tour data found for this tenant.");

      const byTour = new Map<string, { revenue: number; deliveries: number; operators: Set<string>; invoiceRefs: Set<string> }>();
      weeklyPayRows.forEach((row) => {
        const tour = row.tour || "Unknown Tour";
        if (!byTour.has(tour)) {
          byTour.set(tour, { revenue: 0, deliveries: 0, operators: new Set<string>(), invoiceRefs: new Set<string>() });
        }
        const item = byTour.get(tour)!;
        item.revenue += toNumber(row.yodel_weekly_amount);
        item.deliveries += toNumber(row.total_qty);
        if (row.operator_id) item.operators.add(row.operator_id);
        if (row.invoice_number) item.invoiceRefs.add(row.invoice_number);
      });

      const rows = Array.from(byTour.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([tour, item]) => [
          tour,
          formatGBP(item.revenue),
          item.deliveries.toLocaleString("en-GB"),
          item.operators.size.toString(),
          item.invoiceRefs.size.toString(),
        ]);

      const doc = new jsPDF({ orientation: "landscape" });
      addHeader(doc, "Tour Report", `${tenant?.company_name || "Tenant"} - revenue and deliveries by tour`);
      autoTable(doc, {
        startY: 34,
        head: [["Tour", "Revenue", "Deliveries", "Drivers Involved", "Invoice Cycles"]],
        body: rows,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [31, 41, 55] },
      });
      doc.save(buildFilename("tour-report"));

      toast({
        title: "Tour report exported",
        description: `Exported ${rows.length} tours.`,
      });
    } catch (error: any) {
      toast({
        title: "Tour report failed",
        description: error.message || "Unable to export tour report.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Driver Report (PDF)
          </CardTitle>
          <CardDescription>
            Active drivers with tours, incidents, parcel economics, pay, and profit generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportDriverReport} disabled={tenantLoading || exporting === "driver"} className="w-full">
            {exporting === "driver" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Driver Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Profit Report (PDF)
          </CardTitle>
          <CardDescription>Monthly net profit from first invoice: net revenue - driver pay</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportProfitReport} disabled={tenantLoading || exporting === "profit"} className="w-full">
            {exporting === "profit" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Profit Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            VAT Report (PDF)
          </CardTitle>
          <CardDescription>Quarterly VAT from first invoice quarter to export date</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportVatReport} disabled={tenantLoading || exporting === "vat"} className="w-full">
            {exporting === "vat" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export VAT Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tour Report (PDF)
          </CardTitle>
          <CardDescription>Revenue and deliveries by tour with driver and invoice-cycle counts</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportTourReport} disabled={tenantLoading || exporting === "tour"} className="w-full">
            {exporting === "tour" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export Tour Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsExport;