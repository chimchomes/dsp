import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";

// IMPORTANT: Use legacy build for easier bundling + explicit worker src
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// ------------------------------
// PDF.js Worker config (Vite-safe)
// ------------------------------
// Put the worker file in /public as: pdf.worker.min.mjs
if (typeof window !== "undefined") {
  try {
    const workerUrl = new URL("/pdf.worker.min.mjs", window.location.origin).href;
    // @ts-expect-error
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    // ignore
  }
}

// ------------------------------
// Types (match your DB schema)
// ------------------------------
type WeeklyPayRow = {
  invoice_number: string;
  invoice_date: string; // YYYY-MM-DD
  period_start: string;
  period_end: string;
  operator_id: string;
  tour: string;
  delivered_qty: number;
  collected_qty: number;
  sacks_qty: number;
  packets_qty: number;
  total_qty: number;
  yodel_weekly_amount: number;
};

type DailySummaryRow = {
  invoice_number: string;
  invoice_date: string;
  working_day: string; // YYYY-MM-DD
  operator_id: string;
  tour: string;
  service_group: string;
  qty_paid: number;
  qty_unpaid: number;
  qty_total: number;
  amount_total: number;
};

type DailyQtyRow = {
  invoice_number: string;
  invoice_date: string;
  working_day: string;
  operator_id: string;
  tour: string;
  adhoc_scheduled_collections_qty: number;
  packet_qty: number;
  regular_delivery_qty: number;
  locker_parcel_delivery_qty: number;
  yodel_store_collection_qty: number;
  yodel_store_delivery_qty: number;
  total_qty: number;
};

type AdjustmentDetailRow = {
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
  adjustment_date: string;
  operator_id: string | null;
  tour: string | null;
  parcel_id: string | null;
  adjustment_type: string; // TYPE ONLY (no description)
  adjustment_amount: number; // "- 40.00" => -40
  description: string;
};

type AdjustmentSummaryRow = {
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
  pre_adj_total: number;
  manual_adj_minus: number;
  manual_adj_plus: number;
  post_adj_total: number;
};

type ExtractedInvoiceData = {
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  supplierId: string | null;
  provider: string;
  netTotal: number;
  vat: number;
  grossTotal: number;

  weeklyPayData: WeeklyPayRow[];
  dailySummaryData: DailySummaryRow[];
  dailyPayQtyData: DailyQtyRow[];

  adjustmentDetailData: AdjustmentDetailRow[];
  adjustmentSummaryData: AdjustmentSummaryRow[];
};

const FinanceInvoiceUpload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // -----------------------------------------
  // Helpers
  // -----------------------------------------
  const normalizeText = (text: string): string =>
    text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split("T")[0];

    const textMatch = dateStr.match(
      /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})$/i
    );
    if (textMatch) {
      const day = textMatch[1].padStart(2, "0");
      const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
      const month = String(monthNames.indexOf(textMatch[2].toLowerCase()) + 1).padStart(2, "0");
      const year = textMatch[3].length === 2 ? `20${textMatch[3]}` : textMatch[3];
      return `${year}-${month}-${day}`;
    }

    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, "0");
      const month = slashMatch[2].padStart(2, "0");
      const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
      return `${year}-${month}-${day}`;
    }

    const parsed = new Date(dateStr);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
    return new Date().toISOString().split("T")[0];
  };

  const moneyToNumber = (s: string): number => {
    const cleaned = s.replace(/[Â£,\sÃ‚]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const extractNumber = (text: string, patterns: RegExp[]): number => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return moneyToNumber(m[1]);
    }
    return 0;
  };

  const sliceBetween = (text: string, start: RegExp, end: RegExp | null) => {
    const s = text.search(start);
    if (s === -1) return "";
    let sub = text.slice(s);
    const m = sub.match(start);
    if (m?.[0]) sub = sub.slice(m[0].length);
    if (end) {
      const e = sub.search(end);
      if (e !== -1) sub = sub.slice(0, e);
    }
    return sub.trim();
  };

  // -----------------------------------------
  // PDF extraction (ROW-AWARE using coordinates)
  // This is the real fix.
  // -----------------------------------------
  const extractTextFromPDF = async (pdfFile: File): Promise<string> => {
    // @ts-expect-error
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      throw new Error("PDF.js worker not configured. Ensure /public/pdf.worker.min.mjs exists.");
    }

    const arrayBuffer = await pdfFile.arrayBuffer();
    // @ts-expect-error
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const allLines: string[] = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.0 });
      const content = await page.getTextContent();

      type Item = { str: string; x: number; y: number };
      const items: Item[] = (content.items as any[])
        .map((it) => {
          const s = String(it?.str ?? "").trim();
          if (!s) return null;
          // transform = [a,b,c,d,e,f] => e=x, f=y in page coords
          const tx = it.transform?.[4] ?? 0;
          const ty = it.transform?.[5] ?? 0;
          // Normalize y so grouping works across page orientation
          const x = tx;
          const y = ty;
          return { str: s, x, y };
        })
        .filter(Boolean) as Item[];

      // Group by visual row: round Y to bucket
      const rowMap = new Map<number, Item[]>();
      const yTol = 2; // tolerance bucket

      const bucketY = (y: number) => Math.round(y / yTol) * yTol;

      for (const it of items) {
        const by = bucketY(it.y);
        if (!rowMap.has(by)) rowMap.set(by, []);
        rowMap.get(by)!.push(it);
      }

      // Sort rows top->bottom (higher y is higher on page in PDF coords usually),
      // but PDF.js y increases upwards; to be safe, sort descending by y.
      const rowYs = Array.from(rowMap.keys()).sort((a, b) => b - a);

      for (const y of rowYs) {
        const rowItems = rowMap.get(y)!;
        rowItems.sort((a, b) => a.x - b.x);

        // Build a line with spacing based on x gaps
        let line = "";
        let prevX: number | null = null;

        for (const it of rowItems) {
          if (prevX !== null) {
            const gap = it.x - prevX;
            // If there's a noticeable gap, insert a space
            if (gap > 6 && !line.endsWith(" ")) line += " ";
          } else if (line.length > 0 && !line.endsWith(" ")) {
            line += " ";
          }
          line += it.str;
          prevX = it.x + it.str.length * 3; // rough width proxy
        }

        const cleaned = line.replace(/[ \t]+/g, " ").trim();
        if (cleaned) allLines.push(cleaned);
      }

      allLines.push(""); // page break spacer
    }

    const out = allLines.join("\n").trim();
    if (out.length < 50) {
      throw new Error("PDF appears image-only/empty. Text extraction returned very little content.");
    }
    return out;
  };

  // -----------------------------------------
  // Header extraction (invoice fields)
  // -----------------------------------------
  const extractHeader = (pdfText: string) => {
    const t = normalizeText(pdfText);

    const invoiceNumber =
      t.match(/Invoice\s+No\s*:\s*([A-Z0-9-]+)/i)?.[1]?.trim() ||
      t.match(/\bInvoice\s+No\s*:\s*(\d+)\b/i)?.[1]?.trim() ||
      "";

    if (!invoiceNumber) throw new Error("Could not extract invoice number.");

    const invoiceDateRaw =
      t.match(/Date\s*:\s*([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{2,4})/i)?.[1] ||
      t.match(/Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ||
      "";

    const invoiceDate = invoiceDateRaw ? parseDate(invoiceDateRaw.trim()) : new Date().toISOString().split("T")[0];

    const periodMatch =
      t.match(/Payment\s+Period\s*:\s*([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{2,4})\s*-\s*([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{2,4})/i) ||
      t.match(/Payment\s+Period\s*:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})\s*-\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);

    const periodStart = periodMatch?.[1] ? parseDate(periodMatch[1].trim()) : invoiceDate;
    const periodEnd = periodMatch?.[2] ? parseDate(periodMatch[2].trim()) : invoiceDate;

    const supplierId =
      t.match(/Supplier\s+ID\s*:\s*([A-Z0-9]+)/i)?.[1]?.trim() ?? null;

    const providerMatch = t.match(/\b(YODEL|ROYAL\s+MAIL|DPD|HERMES)\b/i);
    const provider = providerMatch?.[1]?.toUpperCase().replace(/\s+/g, " ") || "YODEL";

    const netTotal = extractNumber(t, [
      /Net\s+Total\s*[Â£€$]?\s*([\d,]+\.\d{2})/i,
      /Net\s+Total[^\d]*([\d,]+\.\d{2})/i,
    ]);
    const vat = extractNumber(t, [
      /VAT\s*@\s*[\d.]+%\s*[Â£€$]?\s*([\d,]+\.\d{2})/i,
      /VAT\s*@\s*20(?:\.00)?%\s*[^\d]*([\d,]+\.\d{2})/i,
      /VAT[^\d]*([\d,]+\.\d{2})/i,
    ]);
    const grossTotal = extractNumber(t, [
      /Gross\s+Total\s*[Â£€$]?\s*([\d,]+\.\d{2})/i,
      /Gross\s+Total[^\d]*([\d,]+\.\d{2})/i,
    ]);

    return { invoiceNumber, invoiceDate, periodStart, periodEnd, supplierId, provider, netTotal, vat, grossTotal };
  };

  // -----------------------------------------
  // WEEKLY_PAY parser
  // -----------------------------------------
  const parseWeeklyPay = (
    pdfText: string,
    invoiceNumber: string,
    invoiceDate: string,
    periodStart: string,
    periodEnd: string
  ): WeeklyPayRow[] => {
    const t = normalizeText(pdfText);
    const block = t.match(/Week\s+Summary[\s\S]*?(?=Daily\s+Breakdown|Manual\s+Adjustments|$)/i)?.[0] ?? "";
    if (!block) return [];

    const rows: WeeklyPayRow[] = [];
    // DB6249 WB43 64 2 0 16 102.50
    const re =
      /\b([A-Z]{2}\d{4,6})\s+([A-Z]{2}\d{2,3})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d,]+\.\d{2})\b/g;

    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      const operator_id = m[1].toUpperCase();
      const tour = m[2].toUpperCase();
      const delivered_qty = parseInt(m[3], 10) || 0;
      const collected_qty = parseInt(m[4], 10) || 0;
      const sacks_qty = parseInt(m[5], 10) || 0;
      const packets_qty = parseInt(m[6], 10) || 0;
      const yodel_weekly_amount = moneyToNumber(m[7]);
      const total_qty = delivered_qty + collected_qty + sacks_qty + packets_qty;

      rows.push({
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        period_start: periodStart,
        period_end: periodEnd,
        operator_id,
        tour,
        delivered_qty,
        collected_qty,
        sacks_qty,
        packets_qty,
        total_qty,
        yodel_weekly_amount,
      });
    }

    return rows;
  };

  // -----------------------------------------
  // DAILY_PAY_SUMMARY + DAILY_PAY_QTY
  // Implements your rules exactly.
  // -----------------------------------------
  const parseDailyBreakdown = (
    pdfText: string,
    invoiceNumber: string,
    invoiceDate: string
  ): { dailySummary: DailySummaryRow[]; dailyQty: DailyQtyRow[] } => {
    const t = normalizeText(pdfText);
    const block = t.match(/Daily\s+Breakdown[\s\S]*?(?=Manual\s+Adjustments|$)/i)?.[0] ?? "";
    if (!block) return { dailySummary: [], dailyQty: [] };

    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^Daily\s+Breakdown$/i.test(l))
      .filter((l) => !/^Date\s+Tour\s+Operator\s+Service\s+Group/i.test(l));

    const weekdayRe = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i;
    const dateStartRe = /^(\d{1,2}\/\d{1,2}\/\d{4})\b/;

    const operatorTokenRe = /\b([A-Z]{2}\d{4,6})\b/;
    const tourPrefixRe = /\b((?:WB|WD)\d{1,2})\b/i;   // WB6
    const tourFullRe = /\b((?:WB|WD)\d{2,3})\b/i;     // WB68
    const suffixDigitStartRe = /^(\d)\b/;

    const serviceGroups = [
      "AdHoc/Scheduled Collections",
      "AdHoc Scheduled Collections",
      "Packet",
      "Regular Delivery",
      "Locker Parcel Delivery",
      "Yodel Store Collection",
      "Yodel Store Delivery",
    ];
    const serviceGroupRe = new RegExp(
      `\\b(${serviceGroups.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
      "i"
    );

    // Must contain at least one "@ rate" occurrence to be a service row.
    const ratesRe = /(\d+)\s*@\s*([\d.]+)/g;
    const moneyEndRe = /([\d,]+\.\d{2})\s*$/;

    // Subtotal lines like: "74 129.50" => no "@", ignore automatically
    const dailySummary: DailySummaryRow[] = [];
    const qtyAgg: Record<string, DailyQtyRow> = {};

    let currentDay: string | null = null;
    let currentOperator: string | null = null;
    let currentTour: string | null = null;

    // State for split-tour situations
    let pendingPrefix: string | null = null;
    let pendingOperator: string | null = null;
    let pendingRowLine: string | null = null;
    let awaitingDateForFirstRow = false;

    const initQtyRow = (working_day: string, operator_id: string, tour: string): DailyQtyRow => ({
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      working_day,
      operator_id,
      tour,
      adhoc_scheduled_collections_qty: 0,
      packet_qty: 0,
      regular_delivery_qty: 0,
      locker_parcel_delivery_qty: 0,
      yodel_store_collection_qty: 0,
      yodel_store_delivery_qty: 0,
      total_qty: 0,
    });

    const applyQty = (row: DailyQtyRow, service_group: string, qty_total: number) => {
      const sg = service_group.toLowerCase();
      if (sg.includes("adhoc")) row.adhoc_scheduled_collections_qty += qty_total;
      else if (sg === "packet") row.packet_qty += qty_total;
      else if (sg.includes("regular")) row.regular_delivery_qty += qty_total;
      else if (sg.includes("locker")) row.locker_parcel_delivery_qty += qty_total;
      else if (sg.includes("yodel store collection")) row.yodel_store_collection_qty += qty_total;
      else if (sg.includes("yodel store delivery")) row.yodel_store_delivery_qty += qty_total;
      row.total_qty += qty_total;
    };

    const parseServiceRowLine = (line: string, working_day: string, operator_id: string, tour: string) => {
      // Must contain rates to be a service row (prevents subtotals becoming rows)
      if (!line.includes("@")) return;

      const sgMatch = line.match(serviceGroupRe);
      if (!sgMatch) return;

      const service_group = sgMatch[1].replace(/\s+/g, " ").trim();
      const moneyMatch = line.match(moneyEndRe);
      if (!moneyMatch) return;

      const amount_total = moneyToNumber(moneyMatch[1]);

      // Based on the actual invoice format from YODEL:
      // The format is: Service Group | TOTAL_QTY | QTY @ RATE | [QTY @ RATE] | AMOUNT
      // Examples:
      // - "Packet 17 17 @ 1.75 29.75" (single rate)
      // - "AdHoc/Scheduled Collections 9 9 @ 1.75 15.75" (single rate)
      // - "Regular Delivery 112 2 @ 0.00 110 @ 1.75 192.50" (multiple rates)
      //
      // CRITICAL: We must ONLY match numbers that are immediately followed by "@ RATE"
      // Do NOT match standalone numbers like "9009" or "2002" that appear elsewhere in the line
      
      let qty_total = 0;
      let qty_unpaid = 0;
      let qty_paid = 0;

      // Invoice format: "Service Group TOTAL_QTY QTY1@RATE1 QTY2@RATE2 AMOUNT"
      // Example: "Yodel Store Collection 4 3 @ 0.00 1 @ 1.50 1.50"
      // RATE column shows breakdown: "3 @ 0.00" (unpaid) + "1 @ 1.50" (paid) = total 4
      
      // Match ALL "QTY @ RATE" patterns
      const ratePattern = /(\d+)\s*@\s*([\d.]+)/g;
      const allMatches: Array<{ qty: number; rate: number }> = [];
      
      ratePattern.lastIndex = 0;
      let match;
      while ((match = ratePattern.exec(line)) !== null) {
        let qtyStr = match[1];
        let qty = parseInt(qtyStr, 10) || 0;
        const rate = parseFloat(match[2]) || 0;
        
        // If qty is 4+ digits, it's concatenated (e.g., "4003" = "4" total + "3" qty)
        // Extract only the rate entry part (the part that makes sense as a qty)
        if (qtyStr.length >= 4) {
          // Try splitting: look for second part with leading zeros or small number
          for (let splitPos = 1; splitPos <= Math.min(3, qtyStr.length - 1); splitPos++) {
            const secondPart = qtyStr.substring(splitPos);
            const secondPartNum = parseInt(secondPart, 10);
            
            // If second part has leading zeros (003, 004) or is small (< 1000), use it
            if ((secondPart.match(/^0+/) || secondPartNum < 1000) && secondPartNum >= 0) {
              qty = secondPartNum;
              break;
            }
          }
        }
        
        allMatches.push({ qty, rate });
      }
      
      if (allMatches.length === 0) {
        console.warn("Could not extract any rate patterns from line:", line);
        return;
      }
      
      // Calculate totals from all matches
      for (const m of allMatches) {
        qty_total += m.qty;
        // Rate of 0.00 means unpaid, anything else is paid
        if (m.rate === 0 || Math.abs(m.rate) < 0.001) {
          qty_unpaid += m.qty;
        } else {
          qty_paid += m.qty;
        }
      }
      
      // Debug logging for ALL lines to catch issues
      console.log(`[${service_group}] Line: ${line.substring(0, 100)}`);
      console.log(`  Matches: ${allMatches.map(m => `${m.qty}@${m.rate}`).join(', ')}`);
      console.log(`  Result: total=${qty_total}, paid=${qty_paid}, unpaid=${qty_unpaid}`);

      // Enforce your rule
      if (qty_total !== qty_paid + qty_unpaid) {
        throw new Error(
          `DAILY_PAY_SUMMARY mismatch ${working_day} ${operator_id} ${tour} ${service_group}: total=${qty_total} paid=${qty_paid} unpaid=${qty_unpaid}. Line=${line}`
        );
      }

      dailySummary.push({
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        working_day,
        operator_id,
        tour,
        service_group,
        qty_paid,
        qty_unpaid,
        qty_total,
        amount_total,
      });

      const key = `${invoiceNumber}__${working_day}__${operator_id}__${tour}`;
      if (!qtyAgg[key]) qtyAgg[key] = initQtyRow(working_day, operator_id, tour);
      applyQty(qtyAgg[key], service_group, qty_total);
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Day header lines (often precede date line)
      if (weekdayRe.test(line)) {
        // If this weekday line contains a split tour prefix/operator + a service row, buffer it.
        // Example: "Sunday WB6 DB6249 Packet 17 017 @ 1.75 29.75"
        const prefix = line.match(tourPrefixRe)?.[1]?.toUpperCase() ?? null;
        const op = line.match(operatorTokenRe)?.[1]?.toUpperCase() ?? null;

        // If it has a prefix and a service group row, we must wait for the next date line to get suffix digit.
        if (prefix && op && line.includes("@")) {
          pendingPrefix = prefix;
          pendingOperator = op;
          pendingRowLine = line.replace(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s+/i, "");
          awaitingDateForFirstRow = true;
          continue;
        }

        // Otherwise just continue; date line will set currentDay.
        continue;
      }

      // Date line: "14/12/2025 8 Regular Delivery 57 057 @ 1.75 99.75"
      const dm = line.match(dateStartRe);
      if (dm) {
        currentDay = parseDate(dm[1]);

        let rest = line.replace(dm[0], "").trim();

        // If next token is a suffix digit, combine with pendingPrefix
        const suffix = rest.match(suffixDigitStartRe)?.[1] ?? null;
        if (suffix) rest = rest.replace(suffixDigitStartRe, "").trim();

        if (awaitingDateForFirstRow && pendingPrefix && pendingOperator && suffix) {
          currentTour = `${pendingPrefix}${suffix}`.toUpperCase();
          currentOperator = pendingOperator;

          // Parse the buffered first service row using the completed tour/day/operator
          if (pendingRowLine) parseServiceRowLine(pendingRowLine, currentDay, currentOperator, currentTour);

          // Clear pending state
          pendingPrefix = null;
          pendingOperator = null;
          pendingRowLine = null;
          awaitingDateForFirstRow = false;

          // Parse the service row contained on the date line using same operator/tour
          if (currentOperator && currentTour) parseServiceRowLine(rest, currentDay, currentOperator, currentTour);
          continue;
        }

        // If we have a pendingPrefix awaiting suffix (non-weekday case)
        if (pendingPrefix && pendingOperator && suffix) {
          currentTour = `${pendingPrefix}${suffix}`.toUpperCase();
          currentOperator = pendingOperator;

          if (pendingRowLine) parseServiceRowLine(pendingRowLine, currentDay, currentOperator, currentTour);

          pendingPrefix = null;
          pendingOperator = null;
          pendingRowLine = null;

          if (currentOperator && currentTour) parseServiceRowLine(rest, currentDay, currentOperator, currentTour);
          continue;
        }

        // If date line includes a full tour/operator already (rare), allow it:
        const fullTour = rest.match(tourFullRe)?.[1]?.toUpperCase() ?? null;
        const op = rest.match(operatorTokenRe)?.[1]?.toUpperCase() ?? null;
        if (fullTour) currentTour = fullTour;
        if (op) currentOperator = op;

        if (currentDay && currentOperator && currentTour) parseServiceRowLine(rest, currentDay, currentOperator, currentTour);
        continue;
      }

      // Lines that start a new tour/operator block without date
      // Example: "WB8 DB6261 AdHoc/Scheduled Collections 1 001 @ 1.75 1.75"
      // Next line might start with suffix digit "0 Packet ..."
      const prefixStart = line.match(new RegExp(`^${tourPrefixRe.source}`, "i"))?.[1]?.toUpperCase() ?? null;
      if (prefixStart) {
        const op = line.match(operatorTokenRe)?.[1]?.toUpperCase() ?? null;
        if (op) {
          pendingPrefix = prefixStart;
          pendingOperator = op;
          // Buffer this row if it's a service row; it needs suffix to become WB80 etc.
          if (line.includes("@")) pendingRowLine = line;
          continue;
        }
      }

      // Suffix digit line after prefixStart: "0 Packet 22 022 @ 1.75 38.50"
      const sd = line.match(suffixDigitStartRe)?.[1] ?? null;
      if (sd && pendingPrefix && pendingOperator && currentDay) {
        currentTour = `${pendingPrefix}${sd}`.toUpperCase();
        currentOperator = pendingOperator;

        if (pendingRowLine) parseServiceRowLine(pendingRowLine, currentDay, currentOperator, currentTour);

        pendingPrefix = null;
        pendingOperator = null;
        pendingRowLine = null;

        const rest = line.replace(suffixDigitStartRe, "").trim();
        if (currentOperator && currentTour) parseServiceRowLine(rest, currentDay, currentOperator, currentTour);
        continue;
      }

      // Normal continuation service row lines without operator/tour/date:
      // Example: "Regular Delivery 64 064 @ 1.25 80.00"
      if (currentDay && currentOperator && currentTour) {
        parseServiceRowLine(line, currentDay, currentOperator, currentTour);
      }
    }

    // Build DAILY_PAY_QTY array and enforce total_qty = sum of 6 columns
    const dailyQty = Object.values(qtyAgg).map((r) => {
      const expected =
        r.adhoc_scheduled_collections_qty +
        r.packet_qty +
        r.regular_delivery_qty +
        r.locker_parcel_delivery_qty +
        r.yodel_store_collection_qty +
        r.yodel_store_delivery_qty;

      if (r.total_qty !== expected) {
        throw new Error(
          `DAILY_PAY_QTY mismatch ${r.working_day} ${r.operator_id} ${r.tour}: total_qty=${r.total_qty} sum=${expected}`
        );
      }
      return r;
    });

    return { dailySummary, dailyQty };
  };

  // -----------------------------------------
  // Manual Adjustments (DETAIL + SUMMARY)
  // DETAIL: Type only, amount on its own line, "- 40.00" negative
  // -----------------------------------------
  const parseManualAdjustments = (
    pdfText: string,
    invoiceNumber: string,
    invoiceDate: string,
    periodStart: string,
    periodEnd: string
  ): { details: AdjustmentDetailRow[]; summary: AdjustmentSummaryRow[] } => {
    const t = normalizeText(pdfText);

    // DETAIL section (page with columns Date Tour Operator Parcel Id Type Amount)
    const detailBlock = t.match(/Manual\s+Adjustments[\s\S]*?(?=Total\s+Deductions|Total\s+Additional\s+Payment|$)/i)?.[0] ?? "";
    const lines = detailBlock
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^Manual\s+Adjustments$/i.test(l))
      .filter((l) => !/^Date\s+Tour\s+Operator\s+Parcel/i.test(l));

    const details: AdjustmentDetailRow[] = [];
    let i = 0;
    // Updated regex: parcel_id should only match if it's clearly a parcel ID (alphanumeric with numbers or specific patterns)
    // Don't match words like "PREMIUM" that are part of the type
    const fullRowRe =
      /^(?<date>\d{1,2}\/\d{1,2}\/\d{4})\s+(?<tour>[A-Z]{2}\d{2,3})\s+(?<operator>[A-Z]{2}\d{4,6})?(?:\s+(?<parcel>(?:[A-Z]+\d+|\d+[A-Z]+|\d+)))?\s*(?<typeDesc>[\s\S]*?)\s+(?<amount>-?\s*[\d,]+\.\d{2})$/i;

    while (i < lines.length) {
      const line = lines[i];
      // eslint-disable-next-line no-console
      console.log("Processing adjustment line:", line);
      const match = line.match(fullRowRe);

      if (match?.groups) {
        // eslint-disable-next-line no-console
        console.log("Regex match groups:", match.groups);
        const adjustment_date = parseDate(match.groups.date);
        const tour = match.groups.tour.toUpperCase();
        const operator_id = match.groups.operator?.toUpperCase() ?? null;
        let parcel_id = match.groups.parcel?.toUpperCase() ?? null;
        const amount = moneyToNumber(match.groups.amount);

        let adjustment_type = match.groups.typeDesc.trim();
        let description = "";

        // Fix: If parcel_id was incorrectly captured as a type modifier word (like "PREMIUM"), 
        // it should be part of adjustment_type, not parcel_id
        const typeModifiers = ["PREMIUM", "FAILED", "OPERATING", "PAYMENT", "DEDUCTION", "OBLIGATIONS", "KPI"];
        if (parcel_id && typeModifiers.includes(parcel_id)) {
          // Prepend it back to adjustment_type and clear parcel_id
          adjustment_type = `${parcel_id} ${adjustment_type}`.trim();
          parcel_id = null;
        }

        // Heuristic to split type and description if they are combined
        if (adjustment_type.toLowerCase().includes("premium operating payment") || 
            (adjustment_type.toLowerCase().includes("premium") && adjustment_type.toLowerCase().includes("operating payment"))) {
          adjustment_type = "Premium Operating Payment";
          description = match.groups.typeDesc.replace(/Premium\s+Operating\s+Payment\s*/i, "").trim();
          // Also check if description is in the original typeDesc after removing the type
          if (!description && match.groups.typeDesc.toLowerCase().includes("x1.25")) {
            description = match.groups.typeDesc.replace(/Premium\s+Operating\s+Payment\s*/i, "").trim();
          }
        } else if (adjustment_type.includes("Failed KPI / Obligations Deduction")) {
          adjustment_type = "Failed KPI / Obligations Deduction";
          description = match.groups.typeDesc.replace(/Failed KPI \/ Obligations Deduction\s*/i, "").trim();
        }

        // Check the next line for description if not found yet
        if (!description && i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          // Ensure next line is not a new adjustment row or a total line
          if (!fullRowRe.test(nextLine) && !/Total\s+Deductions|Total\s+Additional\s+Payment|Manual\s+Adjustments\s+Deduction\s+Total/i.test(nextLine)) {
            description = nextLine.trim();
            // eslint-disable-next-line no-console
            console.log("Found description on next line:", description);
            i++; // Consume the next line as part of the current entry
          }
        }

        if (adjustment_type && amount !== 0) {
          details.push({
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            period_start: periodStart,
            period_end: periodEnd,
            adjustment_date,
            operator_id,
            tour,
            parcel_id,
            adjustment_type,
            adjustment_amount: amount,
            description,
          });
        }
      }
      i++;
    }

    // SUMMARY from Week Summary totals lines
    const weekBlock = t.match(/Week\s+Summary[\s\S]*?(?=Daily\s+Breakdown|$)/i)?.[0] ?? "";

    const pre_adj_total = extractNumber(weekBlock, [
      /Total\s+\d+\s+\d+\s+\d+\s+\d+\s+([\d,]+\.\d{2})/i,
    ]);

    const manual_adj_minus = extractNumber(weekBlock, [
      /Manual\s+Adjustments\s*-\s*Â£?\s*([\d,]+\.\d{2})/i,
    ]);

    const manual_adj_plus = extractNumber(weekBlock, [
      /Manual\s+Adjustments\s*Â£\s*([\d,]+\.\d{2})/i,
    ]);

    const post_adj_total = extractNumber(weekBlock, [
      /Total\s*Â£\s*([\d,]+\.\d{2})/i,
    ]);

    const summary: AdjustmentSummaryRow[] = [
      {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        period_start: periodStart,
        period_end: periodEnd,
        pre_adj_total,
        manual_adj_minus,
        manual_adj_plus,
        post_adj_total,
      },
    ];

    return { details, summary };
  };

  // -----------------------------------------
  // Full extraction
  // -----------------------------------------
  const extractInvoiceData = async (pdfText: string): Promise<ExtractedInvoiceData> => {
    const header = extractHeader(pdfText);

    const weeklyPayData = parseWeeklyPay(
      pdfText,
      header.invoiceNumber,
      header.invoiceDate,
      header.periodStart,
      header.periodEnd
    );

    const { dailySummary, dailyQty } = parseDailyBreakdown(
      pdfText,
      header.invoiceNumber,
      header.invoiceDate
    );

    const { details: adjustmentDetailData, summary: adjustmentSummaryData } =
      parseManualAdjustments(
        pdfText,
        header.invoiceNumber,
        header.invoiceDate,
        header.periodStart,
        header.periodEnd
      );

    return {
      ...header,
      weeklyPayData,
      dailySummaryData: dailySummary,
      dailyPayQtyData: dailyQty,
      adjustmentDetailData,
      adjustmentSummaryData,
    };
  };

  // -----------------------------------------
  // Upload + Upsert pipeline
  // -----------------------------------------
  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a PDF file to upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) throw new Error("User not authenticated");

      // 1) Extract text (row-aware)
      const pdfText = await extractTextFromPDF(file);

      // 2) Parse
      const invoiceData = await extractInvoiceData(pdfText);

      // eslint-disable-next-line no-console
      console.log("Parsed counts:", {
        invoiceNumber: invoiceData.invoiceNumber,
        weeklyPay: invoiceData.weeklyPayData.length,
        dailySummary: invoiceData.dailySummaryData.length,
        dailyQty: invoiceData.dailyPayQtyData.length,
        adjDetail: invoiceData.adjustmentDetailData.length,
        adjSummary: invoiceData.adjustmentSummaryData.length,
      });

      // 3) Upload PDF to storage (idempotent overwrite)
      const fileExt = file.name.split(".").pop() || "pdf";
      const fileName = `${invoiceData.invoiceNumber}.${fileExt}`;
      const filePath = `invoices/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("delivery-files")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("delivery-files").getPublicUrl(filePath);
      const pdfUrl = urlData.publicUrl;

      // 4) Upsert invoice header
      const { error: invoiceError } = await supabase
        .from("invoices")
        .upsert(
          {
            invoice_number: invoiceData.invoiceNumber,
            invoice_date: invoiceData.invoiceDate,
            period_start: invoiceData.periodStart,
            period_end: invoiceData.periodEnd,
            supplier_id: invoiceData.supplierId,
            provider: invoiceData.provider,
            pdf_url: pdfUrl,
            uploaded_by: user.id,
            net_total: invoiceData.netTotal,
            vat: invoiceData.vat,
            gross_total: invoiceData.grossTotal,
          },
          { onConflict: "invoice_number" }
        );
      if (invoiceError) throw invoiceError;

      // 5) WEEKLY_PAY upsert (PK invoice_number, operator_id, tour)
      if (invoiceData.weeklyPayData.length > 0) {
        const { error } = await supabase
          .from("WEEKLY_PAY")
          .upsert(invoiceData.weeklyPayData, { onConflict: "invoice_number,operator_id,tour" });
        if (error) throw error;
      }

      // 6) DAILY_PAY_SUMMARY upsert (PK includes service_group)
      if (invoiceData.dailySummaryData.length > 0) {
        const { error } = await supabase
          .from("DAILY_PAY_SUMMARY")
          .upsert(invoiceData.dailySummaryData, {
            onConflict: "invoice_number,working_day,operator_id,tour,service_group",
          });
        if (error) throw error;
      }

      // 7) DAILY_PAY_QTY upsert (PK invoice_number, working_day, operator_id, tour)
      if (invoiceData.dailyPayQtyData.length > 0) {
        const { error } = await supabase
          .from("DAILY_PAY_QTY")
          .upsert(invoiceData.dailyPayQtyData, {
            onConflict: "invoice_number,working_day,operator_id,tour",
          });
        if (error) throw error;
      }

      // 8) ADJUSTMENT_DETAIL: delete+insert (UUID id default)
      {
        const { error: delErr } = await supabase
          .from("ADJUSTMENT_DETAIL")
          .delete()
          .eq("invoice_number", invoiceData.invoiceNumber);
        if (delErr) throw delErr;

        if (invoiceData.adjustmentDetailData.length > 0) {
          const { error: insErr } = await supabase
            .from("ADJUSTMENT_DETAIL")
            .insert(invoiceData.adjustmentDetailData);
          if (insErr) throw insErr;
        }
      }

      // 9) ADJUSTMENT_SUMMARY upsert
      if (invoiceData.adjustmentSummaryData.length > 0) {
        const { error } = await supabase
          .from("ADJUSTMENT_SUMMARY")
          .upsert(invoiceData.adjustmentSummaryData, { onConflict: "invoice_number" });
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Invoice ${invoiceData.invoiceNumber} uploaded and processed successfully`,
      });

      setFile(null);
      navigate("/finance/invoices");
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to upload invoice",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const selectedInfo = useMemo(() => {
    if (!file) return null;
    return `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  }, [file]);

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
              <h1 className="text-3xl font-bold">Upload Invoice</h1>
              <p className="text-muted-foreground mt-1">Upload and process invoice PDFs</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upload Invoice PDF</CardTitle>
              <CardDescription>Upload a YODEL invoice PDF for processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-file">Invoice PDF File</Label>
                <Input
                  id="invoice-file"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) setFile(selectedFile);
                  }}
                />
                {selectedInfo && (
                  <p className="text-sm text-muted-foreground">Selected: {selectedInfo}</p>
                )}
              </div>

              <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload and Process Invoice
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

export default FinanceInvoiceUpload;