import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ArrowLeft, Download, CalendarIcon, Loader2, Users, PoundSterling,
  TrendingUp, MapPin, BarChart3, Percent, Play,
} from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────

type InsightCategory = "driver-pay" | "adjustments" | "revenue" | "routes";

interface InsightDef {
  id: string;
  name: string;
  desc: string;
  category: InsightCategory;
  filters: string[];
}

interface DriverInfo {
  id: string;
  name: string | null;
  operator_id: string | null;
  first_name: string | null;
  surname: string | null;
  email: string | null;
}

interface ReportData {
  chartData: any[];
  tableHeaders: string[];
  tableRows: (string | number)[][];
  summary?: { label: string; value: string; color?: string }[];
  extraOperators?: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7", "#f43f5e", "#0ea5e9", "#eab308", "#64748b",
];

const INSIGHTS: InsightDef[] = [
  { id: "net-pay-per-driver", name: "Net Pay Per Driver", desc: "Total and per period pay breakdown", category: "driver-pay", filters: ["dateRange", "driver", "invoice"] },
  { id: "top-drivers-deliveries", name: "Top Drivers by Deliveries", desc: "Ranked by delivery quantity", category: "driver-pay", filters: ["dateRange", "driver", "invoice"] },
  { id: "top-drivers-payout", name: "Top Drivers by Payout", desc: "Ranked by payout amount", category: "driver-pay", filters: ["dateRange", "driver", "invoice"] },
  { id: "deliveries-per-driver", name: "Deliveries Per Driver/Period", desc: "Daily delivery breakdown", category: "driver-pay", filters: ["dateRange", "driver", "invoice", "tour"] },
  { id: "driver-days-worked", name: "Driver Days Worked", desc: "Unique working days per driver", category: "driver-pay", filters: ["dateRange", "driver", "invoice"] },
  { id: "driver-volume-analysis", name: "Driver Delivery Volume", desc: "Volume trends over time", category: "driver-pay", filters: ["dateRange", "driver", "tour"] },
  { id: "net-adjustments", name: "Net Adjustments Per Driver", desc: "Total adjustments per driver", category: "adjustments", filters: ["dateRange", "driver", "invoice"] },
  { id: "adjustment-percentage", name: "% of Adjustments", desc: "Positive vs negative split", category: "adjustments", filters: ["dateRange", "driver", "invoice"] },
  { id: "adjustment-losses", name: "Adjustment Losses", desc: "Negative adjustments breakdown", category: "adjustments", filters: ["dateRange", "driver", "invoice"] },
  { id: "net-income-supplier", name: "Net Income from Supplier", desc: "Total and per period income", category: "revenue", filters: ["dateRange", "invoice"] },
  { id: "invoice-vs-payouts", name: "Invoice vs Driver Payouts", desc: "Margin per period/invoice", category: "revenue", filters: ["dateRange", "driver", "invoice"] },
  { id: "paid-vs-unpaid", name: "Paid vs Unpaid Deliveries", desc: "Payment status breakdown", category: "revenue", filters: ["dateRange", "driver", "invoice", "tour"] },
  { id: "deliveries-by-route", name: "Total Deliveries by Route", desc: "Per tour/route totals", category: "routes", filters: ["dateRange", "driver", "invoice", "tour"] },
  { id: "best-worst-routes", name: "Best/Worst Routes", desc: "Ranked by performance", category: "routes", filters: ["dateRange", "driver", "invoice"] },
  { id: "most-profitable-route", name: "Most Profitable Route", desc: "Revenue vs cost per route", category: "routes", filters: ["dateRange", "driver", "invoice"] },
  { id: "busy-periods", name: "Identify Busy Periods", desc: "Volume patterns over time", category: "routes", filters: ["dateRange", "tour"] },
];

const CATEGORY_META: Record<InsightCategory, { label: string; icon: React.ElementType }> = {
  "driver-pay": { label: "Driver Pay & Performance", icon: Users },
  adjustments: { label: "Adjustments", icon: Percent },
  revenue: { label: "Revenue & Profitability", icon: PoundSterling },
  routes: { label: "Route / Tour Analysis", icon: MapPin },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("en-GB"); } catch { return d; }
};

const CurrTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} style={{ color: e.color }}>{e.name}: {fmt(e.value)}</p>
      ))}
    </div>
  );
};

const NumTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} style={{ color: e.color }}>{e.name}: {typeof e.value === "number" ? e.value.toLocaleString() : e.value}</p>
      ))}
    </div>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────

const FinanceInsights = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // UI state
  const [activeCategory, setActiveCategory] = useState<InsightCategory>("driver-pay");
  const [selectedInsight, setSelectedInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedDriver, setSelectedDriver] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState("all");
  const [selectedTour, setSelectedTour] = useState("all");

  // Filter options
  const [drivers, setDrivers] = useState<DriverInfo[]>([]);
  const [invoiceNumbers, setInvoiceNumbers] = useState<string[]>([]);
  const [tours, setTours] = useState<string[]>([]);

  // ── Load filter options ────────────────────────────────────────────────────

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const [driversRes, invoicesRes, toursRes] = await Promise.all([
        supabase.from("driver_profiles").select("id, name, email, operator_id, first_name, surname").eq("active", true).order("name"),
        supabase.from("invoices").select("invoice_number").order("invoice_number"),
        supabase.from("WEEKLY_PAY").select("tour"),
      ]);
      setDrivers((driversRes.data as any[]) || []);
      setInvoiceNumbers([...new Set((invoicesRes.data || []).map((i: any) => i.invoice_number))]);
      setTours([...new Set((toursRes.data || []).map((t: any) => t.tour).filter(Boolean))].sort());
    } catch (err: any) {
      console.error("Error loading filter options:", err);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const driverName = (operatorId: string): string => {
    const d = drivers.find(dr => dr.operator_id === operatorId);
    if (d) return d.first_name && d.surname ? `${d.first_name} ${d.surname}` : d.name || d.email || operatorId;
    return operatorId;
  };

  const driverNameById = (id: string): string => {
    const d = drivers.find(dr => dr.id === id);
    if (d) return d.first_name && d.surname ? `${d.first_name} ${d.surname}` : d.name || d.email || id;
    return id;
  };

  const selectedOperatorId = (): string | null => {
    if (selectedDriver === "all") return null;
    return drivers.find(d => d.id === selectedDriver)?.operator_id || null;
  };

  const applyFilters = (
    query: any,
    opts: { dateField?: string; opField?: string; driverIdField?: string; invField?: string; tourField?: string }
  ) => {
    if (opts.dateField && dateRange?.from) query = query.gte(opts.dateField, format(dateRange.from, "yyyy-MM-dd"));
    if (opts.dateField && dateRange?.to) query = query.lte(opts.dateField, format(dateRange.to, "yyyy-MM-dd"));
    if (opts.opField && selectedOperatorId()) query = query.eq(opts.opField, selectedOperatorId());
    if (opts.driverIdField && selectedDriver !== "all") query = query.eq(opts.driverIdField, selectedDriver);
    if (opts.invField && selectedInvoice !== "all") query = query.eq(opts.invField, selectedInvoice);
    if (opts.tourField && selectedTour !== "all") query = query.eq(opts.tourField, selectedTour);
    return query;
  };

  // ── Run Report ─────────────────────────────────────────────────────────────

  const runReport = async () => {
    if (!selectedInsight) {
      toast({ title: "Select a report", description: "Please choose an insight report first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setReportData(null);
    try {
      switch (selectedInsight) {
        case "net-pay-per-driver": await runNetPayPerDriver(); break;
        case "top-drivers-deliveries": await runTopDriversDeliveries(); break;
        case "top-drivers-payout": await runTopDriversPayout(); break;
        case "deliveries-per-driver": await runDeliveriesPerDriver(); break;
        case "driver-days-worked": await runDriverDaysWorked(); break;
        case "driver-volume-analysis": await runDriverVolumeAnalysis(); break;
        case "net-adjustments": await runNetAdjustments(); break;
        case "adjustment-percentage": await runAdjustmentPercentage(); break;
        case "adjustment-losses": await runAdjustmentLosses(); break;
        case "net-income-supplier": await runNetIncomeSupplier(); break;
        case "invoice-vs-payouts": await runInvoiceVsPayouts(); break;
        case "paid-vs-unpaid": await runPaidVsUnpaid(); break;
        case "deliveries-by-route": await runDeliveriesByRoute(); break;
        case "best-worst-routes": await runBestWorstRoutes(); break;
        case "most-profitable-route": await runMostProfitableRoute(); break;
        case "busy-periods": await runBusyPeriods(); break;
        default: break;
      }
    } catch (err: any) {
      toast({ title: "Error running report", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Report Queries ─────────────────────────────────────────────────────────

  // 1. Net Pay Per Driver
  const runNetPayPerDriver = async () => {
    let q = supabase.from("payslips").select("driver_id, gross_pay, deductions, net_pay, invoice_date, invoice_number");
    q = applyFilters(q, { dateField: "invoice_date", driverIdField: "driver_id", invField: "invoice_number" });
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, { gross: number; ded: number; net: number }> = {};
    (data || []).forEach((p: any) => {
      const key = p.driver_id;
      if (!map[key]) map[key] = { gross: 0, ded: 0, net: 0 };
      map[key].gross += Number(p.gross_pay || 0);
      map[key].ded += Number(p.deductions || 0);
      map[key].net += Number(p.net_pay || 0);
    });
    const chartData = Object.entries(map).map(([id, v]) => ({
      name: driverNameById(id), grossPay: v.gross, deductions: Math.abs(v.ded), netPay: v.net,
    })).sort((a, b) => b.netPay - a.netPay);
    const totalGross = chartData.reduce((s, d) => s + d.grossPay, 0);
    const totalNet = chartData.reduce((s, d) => s + d.netPay, 0);
    setReportData({
      chartData,
      summary: [
        { label: "Total Gross Pay", value: fmt(totalGross) },
        { label: "Total Net Pay", value: fmt(totalNet) },
        { label: "Drivers", value: chartData.length.toString() },
      ],
      tableHeaders: ["Driver", "Gross Pay", "Deductions", "Net Pay"],
      tableRows: chartData.map(d => [d.name, fmt(d.grossPay), fmt(d.deductions), fmt(d.netPay)]),
    });
  };

  // 2. Top Drivers by Deliveries
  const runTopDriversDeliveries = async () => {
    let q = supabase.from("WEEKLY_PAY").select("operator_id, total_qty, invoice_date, invoice_number");
    q = applyFilters(q, { dateField: "invoice_date", opField: "operator_id", invField: "invoice_number" });
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => { map[r.operator_id] = (map[r.operator_id] || 0) + Number(r.total_qty || 0); });
    const chartData = Object.entries(map)
      .map(([op, qty]) => ({ name: driverName(op), deliveries: qty }))
      .sort((a, b) => b.deliveries - a.deliveries);
    setReportData({
      chartData,
      summary: [
        { label: "Top Driver", value: chartData[0]?.name || "N/A" },
        { label: "Highest Deliveries", value: (chartData[0]?.deliveries || 0).toLocaleString() },
        { label: "Total Deliveries", value: chartData.reduce((s, d) => s + d.deliveries, 0).toLocaleString() },
      ],
      tableHeaders: ["Rank", "Driver", "Total Deliveries"],
      tableRows: chartData.map((d, i) => [i + 1, d.name, d.deliveries.toLocaleString()]),
    });
  };

  // 3. Top Drivers by Payout
  const runTopDriversPayout = async () => {
    let q = supabase.from("payslips").select("driver_id, gross_pay, invoice_date, invoice_number");
    q = applyFilters(q, { dateField: "invoice_date", driverIdField: "driver_id", invField: "invoice_number" });
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, number> = {};
    (data || []).forEach((p: any) => { map[p.driver_id] = (map[p.driver_id] || 0) + Number(p.gross_pay || 0); });
    const chartData = Object.entries(map)
      .map(([id, pay]) => ({ name: driverNameById(id), payout: pay }))
      .sort((a, b) => b.payout - a.payout);
    setReportData({
      chartData,
      summary: [
        { label: "Top Earner", value: chartData[0]?.name || "N/A" },
        { label: "Highest Payout", value: fmt(chartData[0]?.payout || 0) },
        { label: "Total Payouts", value: fmt(chartData.reduce((s, d) => s + d.payout, 0)) },
      ],
      tableHeaders: ["Rank", "Driver", "Total Payout"],
      tableRows: chartData.map((d, i) => [i + 1, d.name, fmt(d.payout)]),
    });
  };

  // 4. Deliveries Per Driver Per Period
  const runDeliveriesPerDriver = async () => {
    let q = supabase.from("DAILY_PAY_SUMMARY").select("working_day, operator_id, qty_total, invoice_number, tour");
    q = applyFilters(q, { dateField: "working_day", opField: "operator_id", invField: "invoice_number", tourField: "tour" });
    q = q.order("working_day", { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    const operators = [...new Set((data || []).map((r: any) => r.operator_id as string))];
    const dateMap: Record<string, any> = {};
    (data || []).forEach((r: any) => {
      const d = r.working_day;
      if (!dateMap[d]) dateMap[d] = { date: d, dateLabel: fmtDate(d) };
      dateMap[d][r.operator_id] = (dateMap[d][r.operator_id] || 0) + Number(r.qty_total || 0);
    });
    const chartData = Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const totalByOp: Record<string, number> = {};
    (data || []).forEach((r: any) => { totalByOp[r.operator_id] = (totalByOp[r.operator_id] || 0) + Number(r.qty_total || 0); });
    setReportData({
      chartData,
      extraOperators: operators,
      summary: [
        { label: "Days Covered", value: chartData.length.toString() },
        { label: "Drivers", value: operators.length.toString() },
        { label: "Total Deliveries", value: Object.values(totalByOp).reduce((a, b) => a + b, 0).toLocaleString() },
      ],
      tableHeaders: ["Date", ...operators.map(op => driverName(op))],
      tableRows: chartData.map((row: any) => [
        row.dateLabel,
        ...operators.map(op => (row[op] || 0).toLocaleString()),
      ]),
    });
  };

  // 5. Driver Days Worked
  const runDriverDaysWorked = async () => {
    let q = supabase.from("DAILY_PAY_QTY").select("working_day, operator_id, invoice_date, invoice_number");
    q = applyFilters(q, { dateField: "working_day", opField: "operator_id", invField: "invoice_number" });
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, Set<string>> = {};
    (data || []).forEach((r: any) => {
      if (!map[r.operator_id]) map[r.operator_id] = new Set();
      map[r.operator_id].add(r.working_day);
    });
    const chartData = Object.entries(map)
      .map(([op, days]) => ({ name: driverName(op), daysWorked: days.size }))
      .sort((a, b) => b.daysWorked - a.daysWorked);
    setReportData({
      chartData,
      summary: [
        { label: "Most Active", value: chartData[0]?.name || "N/A" },
        { label: "Max Days", value: (chartData[0]?.daysWorked || 0).toString() },
        { label: "Avg Days", value: chartData.length ? (chartData.reduce((s, d) => s + d.daysWorked, 0) / chartData.length).toFixed(1) : "0" },
      ],
      tableHeaders: ["Driver", "Days Worked"],
      tableRows: chartData.map(d => [d.name, d.daysWorked]),
    });
  };

  // 6. Driver Delivery Volume Analysis
  const runDriverVolumeAnalysis = async () => {
    let q = supabase.from("DAILY_PAY_QTY").select("working_day, operator_id, total_qty, tour");
    q = applyFilters(q, { dateField: "working_day", opField: "operator_id", tourField: "tour" });
    q = q.order("working_day", { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    const operators = [...new Set((data || []).map((r: any) => r.operator_id as string))];
    const dateMap: Record<string, any> = {};
    (data || []).forEach((r: any) => {
      const d = r.working_day;
      if (!dateMap[d]) dateMap[d] = { date: d, dateLabel: fmtDate(d) };
      dateMap[d][r.operator_id] = (dateMap[d][r.operator_id] || 0) + Number(r.total_qty || 0);
    });
    const chartData = Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
    setReportData({
      chartData,
      extraOperators: operators,
      summary: [
        { label: "Period", value: chartData.length ? `${chartData[0]?.dateLabel} - ${chartData[chartData.length - 1]?.dateLabel}` : "N/A" },
        { label: "Drivers", value: operators.length.toString() },
      ],
      tableHeaders: ["Date", ...operators.map(op => driverName(op))],
      tableRows: chartData.map((row: any) => [
        row.dateLabel,
        ...operators.map(op => (row[op] || 0).toLocaleString()),
      ]),
    });
  };

  // 7. Net Adjustments Per Driver
  const runNetAdjustments = async () => {
    let q = supabase.from("ADJUSTMENT_DETAIL").select("operator_id, adjustment_amount, adjustment_date, invoice_number");
    q = applyFilters(q, { dateField: "adjustment_date", opField: "operator_id", invField: "invoice_number" });
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => { map[r.operator_id || "Unknown"] = (map[r.operator_id || "Unknown"] || 0) + Number(r.adjustment_amount || 0); });
    const chartData = Object.entries(map)
      .map(([op, amt]) => ({ name: driverName(op), amount: amt, fill: amt >= 0 ? "#10b981" : "#ef4444" }))
      .sort((a, b) => a.amount - b.amount);
    const totalAdj = chartData.reduce((s, d) => s + d.amount, 0);
    setReportData({
      chartData,
      summary: [
        { label: "Net Adjustments", value: fmt(totalAdj), color: totalAdj >= 0 ? "text-green-600" : "text-red-600" },
        { label: "Drivers Affected", value: chartData.length.toString() },
        { label: "Adjustment Count", value: (data || []).length.toString() },
      ],
      tableHeaders: ["Driver", "Net Adjustment"],
      tableRows: chartData.map(d => [d.name, fmt(d.amount)]),
    });
  };

  // 8. % of Adjustments Per Driver
  const runAdjustmentPercentage = async () => {
    let q = supabase.from("ADJUSTMENT_DETAIL").select("operator_id, adjustment_amount, adjustment_date, invoice_number");
    q = applyFilters(q, { dateField: "adjustment_date", opField: "operator_id", invField: "invoice_number" });
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, { pos: number; neg: number }> = {};
    (data || []).forEach((r: any) => {
      const op = r.operator_id || "Unknown";
      if (!map[op]) map[op] = { pos: 0, neg: 0 };
      const amt = Number(r.adjustment_amount || 0);
      if (amt >= 0) map[op].pos += amt; else map[op].neg += Math.abs(amt);
    });
    const chartData = Object.entries(map).map(([op, v]) => {
      const total = v.pos + v.neg;
      return {
        name: driverName(op),
        positive: v.pos, negative: v.neg,
        pctPos: total > 0 ? ((v.pos / total) * 100).toFixed(1) : "0",
        pctNeg: total > 0 ? ((v.neg / total) * 100).toFixed(1) : "0",
      };
    });
    setReportData({
      chartData,
      summary: [
        { label: "Total Positive", value: fmt(chartData.reduce((s, d) => s + d.positive, 0)) },
        { label: "Total Negative", value: fmt(chartData.reduce((s, d) => s + d.negative, 0)) },
      ],
      tableHeaders: ["Driver", "Positive", "Negative", "% Positive", "% Negative"],
      tableRows: chartData.map(d => [d.name, fmt(d.positive), fmt(d.negative), d.pctPos + "%", d.pctNeg + "%"]),
    });
  };

  // 9. Adjustment Losses
  const runAdjustmentLosses = async () => {
    let q = supabase.from("ADJUSTMENT_DETAIL").select("operator_id, adjustment_amount, adjustment_date, invoice_number, adjustment_type, description");
    q = applyFilters(q, { dateField: "adjustment_date", opField: "operator_id", invField: "invoice_number" });
    q = q.lt("adjustment_amount", 0);
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => { map[r.operator_id || "Unknown"] = (map[r.operator_id || "Unknown"] || 0) + Math.abs(Number(r.adjustment_amount || 0)); });
    const chartData = Object.entries(map)
      .map(([op, loss]) => ({ name: driverName(op), loss }))
      .sort((a, b) => b.loss - a.loss);
    const totalLoss = chartData.reduce((s, d) => s + d.loss, 0);
    setReportData({
      chartData,
      summary: [
        { label: "Total Losses", value: fmt(totalLoss), color: "text-red-600" },
        { label: "Highest Loss Driver", value: chartData[0]?.name || "N/A" },
        { label: "Loss Items", value: (data || []).length.toString() },
      ],
      tableHeaders: ["Driver", "Total Loss"],
      tableRows: chartData.map(d => [d.name, fmt(d.loss)]),
    });
  };

  // 10. Net Income from Supplier
  const runNetIncomeSupplier = async () => {
    let q = supabase.from("invoices").select("invoice_number, invoice_date, net_total, vat, gross_total");
    q = applyFilters(q, { dateField: "invoice_date", invField: "invoice_number" });
    q = q.order("invoice_date", { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    const chartData = (data || []).map((inv: any) => ({
      name: fmtDate(inv.invoice_date),
      date: inv.invoice_date,
      invoice: inv.invoice_number,
      netTotal: Number(inv.net_total || 0),
      vat: Number(inv.vat || 0),
      grossTotal: Number(inv.gross_total || 0),
    }));
    const totalNet = chartData.reduce((s, d) => s + d.netTotal, 0);
    const totalVat = chartData.reduce((s, d) => s + d.vat, 0);
    const totalGross = chartData.reduce((s, d) => s + d.grossTotal, 0);
    setReportData({
      chartData,
      summary: [
        { label: "Net Revenue", value: fmt(totalNet) },
        { label: "VAT", value: fmt(totalVat) },
        { label: "Gross Revenue", value: fmt(totalGross) },
        { label: "Invoices", value: chartData.length.toString() },
      ],
      tableHeaders: ["Invoice", "Date", "Net Total", "VAT", "Gross Total"],
      tableRows: chartData.map(d => [d.invoice, d.name, fmt(d.netTotal), fmt(d.vat), fmt(d.grossTotal)]),
    });
  };

  // 11. Invoice vs Driver Payouts
  const runInvoiceVsPayouts = async () => {
    let invQ = supabase.from("invoices").select("invoice_number, invoice_date, net_total");
    invQ = applyFilters(invQ, { dateField: "invoice_date", invField: "invoice_number" });
    let payQ = supabase.from("payslips").select("invoice_number, net_pay, driver_id");
    payQ = applyFilters(payQ, { driverIdField: "driver_id", invField: "invoice_number" });
    const [invRes, payRes] = await Promise.all([invQ, payQ]);
    if (invRes.error) throw invRes.error;
    if (payRes.error) throw payRes.error;
    const payoutMap: Record<string, number> = {};
    (payRes.data || []).forEach((p: any) => { payoutMap[p.invoice_number] = (payoutMap[p.invoice_number] || 0) + Number(p.net_pay || 0); });
    const chartData = (invRes.data || []).map((inv: any) => {
      const revenue = Number(inv.net_total || 0);
      const payouts = payoutMap[inv.invoice_number] || 0;
      return { name: inv.invoice_number, revenue, payouts, margin: revenue - payouts };
    });
    const totalRev = chartData.reduce((s, d) => s + d.revenue, 0);
    const totalPay = chartData.reduce((s, d) => s + d.payouts, 0);
    const totalMargin = totalRev - totalPay;
    setReportData({
      chartData,
      summary: [
        { label: "Total Revenue", value: fmt(totalRev) },
        { label: "Total Payouts", value: fmt(totalPay) },
        { label: "Net Margin", value: fmt(totalMargin), color: totalMargin >= 0 ? "text-green-600" : "text-red-600" },
        { label: "Margin %", value: totalRev > 0 ? ((totalMargin / totalRev) * 100).toFixed(1) + "%" : "N/A" },
      ],
      tableHeaders: ["Invoice", "Revenue", "Driver Payouts", "Margin", "Margin %"],
      tableRows: chartData.map(d => [d.name, fmt(d.revenue), fmt(d.payouts), fmt(d.margin), d.revenue > 0 ? ((d.margin / d.revenue) * 100).toFixed(1) + "%" : "N/A"]),
    });
  };

  // 12. Paid vs Unpaid Deliveries
  const runPaidVsUnpaid = async () => {
    let q = supabase.from("DAILY_PAY_SUMMARY").select("qty_paid, qty_unpaid, qty_total, working_day, operator_id, invoice_number, tour");
    q = applyFilters(q, { dateField: "working_day", opField: "operator_id", invField: "invoice_number", tourField: "tour" });
    const { data, error } = await q;
    if (error) throw error;
    const totalPaid = (data || []).reduce((s: number, r: any) => s + Number(r.qty_paid || 0), 0);
    const totalUnpaid = (data || []).reduce((s: number, r: any) => s + Number(r.qty_unpaid || 0), 0);
    const total = totalPaid + totalUnpaid;
    const chartData = [
      { name: "Paid", value: totalPaid, fill: "#10b981" },
      { name: "Unpaid", value: totalUnpaid, fill: "#ef4444" },
    ];
    // Also breakdown by tour
    const tourMap: Record<string, { paid: number; unpaid: number }> = {};
    (data || []).forEach((r: any) => {
      const t = r.tour || "Unknown";
      if (!tourMap[t]) tourMap[t] = { paid: 0, unpaid: 0 };
      tourMap[t].paid += Number(r.qty_paid || 0);
      tourMap[t].unpaid += Number(r.qty_unpaid || 0);
    });
    const tableRows = Object.entries(tourMap).map(([t, v]) => [
      t, v.paid.toLocaleString(), v.unpaid.toLocaleString(), (v.paid + v.unpaid).toLocaleString(),
      (v.paid + v.unpaid) > 0 ? ((v.paid / (v.paid + v.unpaid)) * 100).toFixed(1) + "%" : "N/A",
    ]);
    setReportData({
      chartData,
      summary: [
        { label: "Total Paid", value: totalPaid.toLocaleString() },
        { label: "Total Unpaid", value: totalUnpaid.toLocaleString() },
        { label: "Paid Rate", value: total > 0 ? ((totalPaid / total) * 100).toFixed(1) + "%" : "N/A" },
      ],
      tableHeaders: ["Tour/Route", "Paid", "Unpaid", "Total", "Paid %"],
      tableRows,
    });
  };

  // 13. Total Deliveries by Route
  const runDeliveriesByRoute = async () => {
    let q = supabase.from("WEEKLY_PAY").select("tour, total_qty, invoice_date, invoice_number, operator_id");
    q = applyFilters(q, { dateField: "invoice_date", opField: "operator_id", invField: "invoice_number", tourField: "tour" });
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, number> = {};
    (data || []).forEach((r: any) => { map[r.tour || "Unknown"] = (map[r.tour || "Unknown"] || 0) + Number(r.total_qty || 0); });
    const chartData = Object.entries(map)
      .map(([tour, qty]) => ({ name: tour, deliveries: qty }))
      .sort((a, b) => b.deliveries - a.deliveries);
    setReportData({
      chartData,
      summary: [
        { label: "Top Route", value: chartData[0]?.name || "N/A" },
        { label: "Total Routes", value: chartData.length.toString() },
        { label: "Total Deliveries", value: chartData.reduce((s, d) => s + d.deliveries, 0).toLocaleString() },
      ],
      tableHeaders: ["Tour/Route", "Total Deliveries"],
      tableRows: chartData.map(d => [d.name, d.deliveries.toLocaleString()]),
    });
  };

  // 14. Best/Worst Routes
  const runBestWorstRoutes = async () => {
    let q = supabase.from("DAILY_PAY_SUMMARY").select("tour, qty_paid, qty_unpaid, qty_total, amount_total, invoice_number, working_day, operator_id");
    q = applyFilters(q, { dateField: "working_day", opField: "operator_id", invField: "invoice_number" });
    const { data, error } = await q;
    if (error) throw error;
    const map: Record<string, { paid: number; unpaid: number; total: number; amount: number; days: Set<string> }> = {};
    (data || []).forEach((r: any) => {
      const t = r.tour || "Unknown";
      if (!map[t]) map[t] = { paid: 0, unpaid: 0, total: 0, amount: 0, days: new Set() };
      map[t].paid += Number(r.qty_paid || 0);
      map[t].unpaid += Number(r.qty_unpaid || 0);
      map[t].total += Number(r.qty_total || 0);
      map[t].amount += Number(r.amount_total || 0);
      map[t].days.add(r.working_day);
    });
    const chartData = Object.entries(map)
      .map(([tour, v]) => ({
        name: tour, deliveries: v.total, paid: v.paid, unpaid: v.unpaid,
        amount: v.amount, days: v.days.size,
        paidRate: v.total > 0 ? (v.paid / v.total) * 100 : 0,
      }))
      .sort((a, b) => b.deliveries - a.deliveries);
    setReportData({
      chartData,
      summary: [
        { label: "Best Route", value: chartData[0]?.name || "N/A" },
        { label: "Worst Route", value: chartData[chartData.length - 1]?.name || "N/A" },
        { label: "Total Routes", value: chartData.length.toString() },
      ],
      tableHeaders: ["Tour/Route", "Total Deliveries", "Paid", "Unpaid", "Paid Rate", "Active Days", "Amount"],
      tableRows: chartData.map(d => [
        d.name, d.deliveries.toLocaleString(), d.paid.toLocaleString(), d.unpaid.toLocaleString(),
        d.paidRate.toFixed(1) + "%", d.days.toString(), fmt(d.amount),
      ]),
    });
  };

  // 15. Most Profitable Route
  const runMostProfitableRoute = async () => {
    let wpQ = supabase.from("WEEKLY_PAY").select("operator_id, tour, total_qty, yodel_weekly_amount, invoice_date, invoice_number");
    wpQ = applyFilters(wpQ, { dateField: "invoice_date", opField: "operator_id", invField: "invoice_number" });
    const [wpRes, ratesRes] = await Promise.all([
      wpQ,
      supabase.from("driver_rates").select("driver_id, rate, operator_id"),
    ]);
    if (wpRes.error) throw wpRes.error;
    // Build operator -> rate map
    const rateMap: Record<string, number> = {};
    (ratesRes.data || []).forEach((r: any) => {
      if (r.operator_id) rateMap[r.operator_id] = Number(r.rate || 0);
      const d = drivers.find(dr => dr.id === r.driver_id);
      if (d?.operator_id && !rateMap[d.operator_id]) rateMap[d.operator_id] = Number(r.rate || 0);
    });
    const tourMap: Record<string, { revenue: number; cost: number; qty: number }> = {};
    (wpRes.data || []).forEach((wp: any) => {
      const t = wp.tour || "Unknown";
      if (!tourMap[t]) tourMap[t] = { revenue: 0, cost: 0, qty: 0 };
      tourMap[t].revenue += Number(wp.yodel_weekly_amount || 0);
      tourMap[t].qty += Number(wp.total_qty || 0);
      tourMap[t].cost += (rateMap[wp.operator_id] || 0) * Number(wp.total_qty || 0);
    });
    const chartData = Object.entries(tourMap)
      .map(([tour, v]) => ({ name: tour, revenue: v.revenue, cost: v.cost, profit: v.revenue - v.cost, qty: v.qty }))
      .sort((a, b) => b.profit - a.profit);
    setReportData({
      chartData,
      summary: [
        { label: "Most Profitable", value: chartData[0]?.name || "N/A" },
        { label: "Best Margin", value: fmt(chartData[0]?.profit || 0) },
        { label: "Total Profit", value: fmt(chartData.reduce((s, d) => s + d.profit, 0)) },
      ],
      tableHeaders: ["Tour/Route", "Revenue", "Driver Cost", "Profit", "Deliveries", "Profit/Delivery"],
      tableRows: chartData.map(d => [
        d.name, fmt(d.revenue), fmt(d.cost), fmt(d.profit), d.qty.toLocaleString(),
        d.qty > 0 ? fmt(d.profit / d.qty) : "N/A",
      ]),
    });
  };

  // 16. Identify Busy Periods
  const runBusyPeriods = async () => {
    let q = supabase.from("DAILY_PAY_QTY").select("working_day, total_qty, tour");
    q = applyFilters(q, { dateField: "working_day", tourField: "tour" });
    q = q.order("working_day", { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    const dateMap: Record<string, number> = {};
    const dowMap: Record<string, { total: number; count: number }> = {};
    (data || []).forEach((r: any) => {
      dateMap[r.working_day] = (dateMap[r.working_day] || 0) + Number(r.total_qty || 0);
      const dow = new Date(r.working_day).toLocaleDateString("en-GB", { weekday: "long" });
      if (!dowMap[dow]) dowMap[dow] = { total: 0, count: 0 };
      dowMap[dow].total += Number(r.total_qty || 0);
      dowMap[dow].count += 1;
    });
    const chartData = Object.entries(dateMap)
      .map(([d, qty]) => ({ date: d, dateLabel: fmtDate(d), deliveries: qty }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const busiestDay = chartData.reduce((max, d) => d.deliveries > (max?.deliveries || 0) ? d : max, chartData[0]);
    // Day of week averages
    const dowOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dowData = dowOrder.filter(d => dowMap[d]).map(d => ({
      name: d.substring(0, 3), avg: Math.round(dowMap[d].total / dowMap[d].count), total: dowMap[d].total,
    }));
    setReportData({
      chartData: chartData.length > 30 ? chartData : chartData, // keep all for chart
      extraOperators: dowData as any, // reuse field for day-of-week data
      summary: [
        { label: "Busiest Day", value: busiestDay ? `${busiestDay.dateLabel} (${busiestDay.deliveries})` : "N/A" },
        { label: "Total Days", value: chartData.length.toString() },
        { label: "Avg/Day", value: chartData.length ? Math.round(chartData.reduce((s, d) => s + d.deliveries, 0) / chartData.length).toString() : "0" },
      ],
      tableHeaders: ["Date", "Deliveries"],
      tableRows: chartData.map(d => [d.dateLabel, d.deliveries.toLocaleString()]),
    });
  };

  // ── PDF Export ──────────────────────────────────────────────────────────────

  const handleDownloadPDF = () => {
    const insight = INSIGHTS.find(i => i.id === selectedInsight);
    if (!insight || !reportData) return;

    // Grab chart SVG from DOM
    const chartEl = document.getElementById("insights-chart-container");
    const svgEl = chartEl?.querySelector("svg");
    const chartSvg = svgEl ? svgEl.outerHTML : "";

    // Build summary HTML
    let summaryHtml = "";
    if (reportData.summary?.length) {
      summaryHtml = `<div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">${reportData.summary.map(s =>
        `<div style="border:1px solid #e0e0e0;border-radius:6px;padding:12px 16px;min-width:140px;background:#fafafa">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px">${s.label}</div>
          <div style="font-size:22px;font-weight:700;margin-top:4px">${s.value}</div>
        </div>`
      ).join("")}</div>`;
    }

    // Build table HTML
    let tableHtml = "";
    if (reportData.tableHeaders.length && reportData.tableRows.length) {
      tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <thead><tr>${reportData.tableHeaders.map(h => `<th style="background:#f1f5f9;font-weight:600;padding:8px 10px;text-align:left;border-bottom:2px solid #d0d5dd">${h}</th>`).join("")}</tr></thead>
        <tbody>${reportData.tableRows.map((row, i) => `<tr>${row.map(cell => `<td style="padding:7px 10px;border-bottom:1px solid #e8e8e8;${i % 2 === 1 ? "background:#fafbfc" : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`;
    }

    // Filter description
    let filtersText = "";
    if (dateRange?.from || dateRange?.to) {
      filtersText += `Period: ${dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "Start"} – ${dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "End"} | `;
    }
    if (selectedDriver !== "all") {
      const d = drivers.find(dr => dr.id === selectedDriver);
      filtersText += `Driver: ${d ? driverNameById(d.id) : selectedDriver} | `;
    }
    if (selectedInvoice !== "all") filtersText += `Invoice: ${selectedInvoice} | `;
    if (selectedTour !== "all") filtersText += `Tour: ${selectedTour} | `;

    const html = `<!DOCTYPE html><html><head><title>${insight.name} - DSP Portal</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;padding:30px;color:#1a1a1a;max-width:1100px;margin:0 auto}
  h1{font-size:22px;margin-bottom:4px}
  .sub{font-size:13px;color:#666;margin-bottom:20px}
  .filters{font-size:12px;color:#888;margin-bottom:24px;padding:8px 12px;background:#f7f7f7;border-radius:4px}
  .chart{margin-bottom:24px;text-align:center}
  .chart svg{max-width:100%;height:auto}
  @media print{body{padding:10px}}
</style></head><body>
  <h1>${insight.name}</h1>
  <div class="sub">DSP Portal Finance Insights &mdash; Generated ${new Date().toLocaleDateString("en-GB")} at ${new Date().toLocaleTimeString("en-GB")}</div>
  ${filtersText ? `<div class="filters">Filters: ${filtersText.replace(/\| $/, "")}</div>` : ""}
  ${summaryHtml}
  ${chartSvg ? `<div class="chart">${chartSvg}</div>` : ""}
  ${tableHtml}
</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onload = () => setTimeout(() => w.print(), 500);
    }
  };

  // ── Chart Rendering ────────────────────────────────────────────────────────

  const renderChart = () => {
    if (!reportData?.chartData?.length) return null;
    const d = reportData.chartData;

    switch (selectedInsight) {
      case "net-pay-per-driver":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={d}><CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} fontSize={12} />
              <YAxis tickFormatter={v => `£${v}`} />
              <Tooltip content={<CurrTooltip />} /><Legend />
              <Bar dataKey="grossPay" name="Gross Pay" fill={COLORS[0]} />
              <Bar dataKey="netPay" name="Net Pay" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "top-drivers-deliveries":
        return (
          <ResponsiveContainer width="100%" height={Math.max(300, d.length * 45)}>
            <BarChart data={d} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" /><YAxis dataKey="name" type="category" width={150} fontSize={12} />
              <Tooltip content={<NumTooltip />} /><Legend />
              <Bar dataKey="deliveries" name="Deliveries" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "top-drivers-payout":
        return (
          <ResponsiveContainer width="100%" height={Math.max(300, d.length * 45)}>
            <BarChart data={d} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={v => `£${v}`} />
              <YAxis dataKey="name" type="category" width={150} fontSize={12} />
              <Tooltip content={<CurrTooltip />} /><Legend />
              <Bar dataKey="payout" name="Payout" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "deliveries-per-driver": {
        const ops = reportData.extraOperators || [];
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={d}><CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" angle={-30} textAnchor="end" height={80} fontSize={11} />
              <YAxis /><Tooltip content={<NumTooltip />} /><Legend />
              {ops.map((op: string, i: number) => (
                <Bar key={op} dataKey={op} name={driverName(op)} fill={COLORS[i % COLORS.length]} stackId="a" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      }

      case "driver-days-worked":
        return (
          <ResponsiveContainer width="100%" height={Math.max(300, d.length * 45)}>
            <BarChart data={d} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" /><YAxis dataKey="name" type="category" width={150} fontSize={12} />
              <Tooltip content={<NumTooltip />} /><Legend />
              <Bar dataKey="daysWorked" name="Days Worked" fill={COLORS[4]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "driver-volume-analysis": {
        const ops = reportData.extraOperators || [];
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={d}><CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dateLabel" angle={-30} textAnchor="end" height={80} fontSize={11} />
              <YAxis /><Tooltip content={<NumTooltip />} /><Legend />
              {ops.map((op: string, i: number) => (
                <Line key={op} type="monotone" dataKey={op} name={driverName(op)} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      }

      case "net-adjustments":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={d}><CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} fontSize={12} />
              <YAxis tickFormatter={v => `£${v}`} />
              <Tooltip content={<CurrTooltip />} />
              <Bar dataKey="amount" name="Net Adjustment">
                {d.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.amount >= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "adjustment-percentage":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={d}><CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} fontSize={12} />
              <YAxis tickFormatter={v => `£${v}`} />
              <Tooltip content={<CurrTooltip />} /><Legend />
              <Bar dataKey="positive" name="Positive" fill="#10b981" stackId="a" />
              <Bar dataKey="negative" name="Negative" fill="#ef4444" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "adjustment-losses":
        return (
          <ResponsiveContainer width="100%" height={Math.max(300, d.length * 45)}>
            <BarChart data={d} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={v => `£${v}`} />
              <YAxis dataKey="name" type="category" width={150} fontSize={12} />
              <Tooltip content={<CurrTooltip />} />
              <Bar dataKey="loss" name="Loss" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "net-income-supplier":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={d}><CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-30} textAnchor="end" height={80} fontSize={11} />
              <YAxis tickFormatter={v => `£${v}`} />
              <Tooltip content={<CurrTooltip />} /><Legend />
              <Area type="monotone" dataKey="netTotal" name="Net Total" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
              <Area type="monotone" dataKey="grossTotal" name="Gross Total" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "invoice-vs-payouts":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={d}><CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} fontSize={11} />
              <YAxis tickFormatter={v => `£${v}`} />
              <Tooltip content={<CurrTooltip />} /><Legend />
              <Bar dataKey="revenue" name="Revenue" fill={COLORS[0]} />
              <Bar dataKey="payouts" name="Payouts" fill={COLORS[3]} />
              <Bar dataKey="margin" name="Margin" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "paid-vs-unpaid":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie data={d} cx="50%" cy="50%" labelLine outerRadius={120}
                dataKey="value" nameKey="name"
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}>
                {d.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "deliveries-by-route":
        return (
          <ResponsiveContainer width="100%" height={Math.max(300, d.length * 40)}>
            <BarChart data={d} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" /><YAxis dataKey="name" type="category" width={120} fontSize={12} />
              <Tooltip content={<NumTooltip />} />
              <Bar dataKey="deliveries" name="Deliveries" fill={COLORS[6]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "best-worst-routes":
        return (
          <ResponsiveContainer width="100%" height={Math.max(300, d.length * 45)}>
            <BarChart data={d} layout="vertical"><CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" /><YAxis dataKey="name" type="category" width={120} fontSize={12} />
              <Tooltip content={<NumTooltip />} /><Legend />
              <Bar dataKey="paid" name="Paid" fill="#10b981" stackId="a" />
              <Bar dataKey="unpaid" name="Unpaid" fill="#ef4444" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "most-profitable-route":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={d}><CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" height={80} fontSize={12} />
              <YAxis tickFormatter={v => `£${v}`} />
              <Tooltip content={<CurrTooltip />} /><Legend />
              <Bar dataKey="revenue" name="Revenue" fill={COLORS[0]} />
              <Bar dataKey="cost" name="Driver Cost" fill={COLORS[3]} />
              <Bar dataKey="profit" name="Profit" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "busy-periods":
        return (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={d}><CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" angle={-30} textAnchor="end" height={80} fontSize={10} />
                <YAxis /><Tooltip content={<NumTooltip />} />
                <Area type="monotone" dataKey="deliveries" name="Deliveries" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
            {/* Day of week breakdown */}
            {reportData.extraOperators && (reportData.extraOperators as any[]).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Average Deliveries by Day of Week</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={reportData.extraOperators as any}><CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" /><YAxis /><Tooltip content={<NumTooltip />} />
                    <Bar dataKey="avg" name="Avg Deliveries" fill={COLORS[4]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ── Get current insight definition ─────────────────────────────────────────

  const currentInsight = INSIGHTS.find(i => i.id === selectedInsight);
  const insightsForCategory = INSIGHTS.filter(i => i.category === activeCategory);

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <AuthGuard allowedRoles={["admin", "finance"]}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/finance")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Finance
              </Button>
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-primary" /> Finance Insights
                </h1>
                <p className="text-muted-foreground mt-1">Select an insight, apply filters, view results, and download as PDF</p>
              </div>
            </div>
            {reportData && (
              <Button onClick={handleDownloadPDF} variant="outline">
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </Button>
            )}
          </div>

          {/* Category Tabs */}
          <Tabs value={activeCategory} onValueChange={(v) => { setActiveCategory(v as InsightCategory); setSelectedInsight(""); setReportData(null); }} className="print:hidden">
            <TabsList className="grid w-full grid-cols-4">
              {(Object.keys(CATEGORY_META) as InsightCategory[]).map(cat => {
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                return (
                  <TabsTrigger key={cat} value={cat} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{meta.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Insight Selector - same for all tabs */}
            {(Object.keys(CATEGORY_META) as InsightCategory[]).map(cat => (
              <TabsContent key={cat} value={cat} className="space-y-4 mt-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {INSIGHTS.filter(i => i.category === cat).map(insight => (
                    <Card
                      key={insight.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 ${selectedInsight === insight.id ? "border-primary ring-2 ring-primary/20 shadow-md" : ""}`}
                      onClick={() => { setSelectedInsight(insight.id); setReportData(null); }}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">{insight.name}</CardTitle>
                        <CardDescription className="text-xs">{insight.desc}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Filters */}
          {selectedInsight && currentInsight && (
            <Card className="print:hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription className="text-sm">Refine your report using the filters below, then click Run Report</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  {/* Date Range */}
                  {currentInsight.filters.includes("dateRange") && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Date Range</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[260px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? `${format(dateRange.from, "dd/MM/yy")} – ${format(dateRange.to, "dd/MM/yy")}` : format(dateRange.from, "dd/MM/yy")
                            ) : "All dates"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Driver */}
                  {currentInsight.filters.includes("driver") && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Driver</label>
                      <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Drivers</SelectItem>
                          {drivers.map(d => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.first_name && d.surname ? `${d.first_name} ${d.surname}` : d.name || d.email || d.id}
                              {d.operator_id ? ` (${d.operator_id})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Invoice */}
                  {currentInsight.filters.includes("invoice") && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Invoice</label>
                      <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Invoices</SelectItem>
                          {invoiceNumbers.map(inv => <SelectItem key={inv} value={inv}>{inv}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Tour */}
                  {currentInsight.filters.includes("tour") && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Tour / Route</label>
                      <Select value={selectedTour} onValueChange={setSelectedTour}>
                        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tours</SelectItem>
                          {tours.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Run & Reset */}
                  <Button onClick={runReport} disabled={loading} className="h-10">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Run Report
                  </Button>
                  <Button variant="ghost" className="h-10" onClick={() => {
                    setDateRange(undefined); setSelectedDriver("all"); setSelectedInvoice("all"); setSelectedTour("all");
                  }}>
                    Reset Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}

          {/* Results */}
          {!loading && reportData && (
            <div id="insights-report-content" className="space-y-6">
              {/* Summary Cards */}
              {reportData.summary && reportData.summary.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {reportData.summary.map((s, i) => (
                    <Card key={i} className="border-l-4" style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${s.color || ""}`}>{s.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Chart */}
              {reportData.chartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{currentInsight?.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div id="insights-chart-container">
                      {renderChart()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Table */}
              {reportData.tableRows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detailed Data</CardTitle>
                    <CardDescription>{reportData.tableRows.length} row{reportData.tableRows.length !== 1 ? "s" : ""}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-auto max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {reportData.tableHeaders.map((h, i) => <TableHead key={i}>{h}</TableHead>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.tableRows.map((row, i) => (
                            <TableRow key={i}>
                              {row.map((cell, j) => (
                                <TableCell key={j} className={j === 0 ? "font-medium" : ""}>{cell}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No data message */}
              {reportData.chartData.length === 0 && reportData.tableRows.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground text-lg">No data found for the selected filters.</p>
                    <p className="text-muted-foreground text-sm mt-2">Try adjusting your filter criteria or date range.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && !reportData && !selectedInsight && (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Select an Insight Report</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Choose a category above, then select a report to get started. Use filters to refine your results, then view charts and tables or download as PDF.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Insight selected but no report run yet */}
          {!loading && !reportData && selectedInsight && (
            <Card>
              <CardContent className="py-12 text-center">
                <Play className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{currentInsight?.name}</h3>
                <p className="text-muted-foreground mb-4">{currentInsight?.desc}</p>
                <p className="text-sm text-muted-foreground">Apply any filters above, then click <strong>Run Report</strong> to generate results.</p>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </AuthGuard>
  );
};

export default FinanceInsights;
