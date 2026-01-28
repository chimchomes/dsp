import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // For Deno/Supabase Edge Functions, we need to use a different approach
    // pdf-parse requires Node.js Buffer which isn't available in Deno
    // We'll extract text using a simpler method that works in Deno
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Simple text extraction from PDF - this works for text-based PDFs
    // For scanned/image PDFs, this won't work and manual entry will be required
    let text = "";
    try {
      // Convert bytes to text (this works for PDFs with embedded text)
      const decoder = new TextDecoder("utf-8", { fatal: false });
      text = decoder.decode(bytes);
      
      // PDFs are binary, so we'll get some readable text mixed with binary
      // Extract only the readable ASCII/Latin text portions
      const lines = text.split(/\r?\n/);
      const readableLines = lines.filter(line => {
        // Filter out lines that are mostly binary/control characters
        const printableChars = line.match(/[\x20-\x7E]/g)?.length || 0;
        return printableChars > line.length * 0.5; // At least 50% printable
      });
      text = readableLines.join('\n');
    } catch (e) {
      console.error("PDF text extraction error:", e);
      return new Response(
        JSON.stringify({ 
          error: "Failed to extract text from PDF. Please use a text-based PDF or enter data manually.",
          requiresManualEntry: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!text || text.trim().length < 100) {
      return new Response(
        JSON.stringify({ 
          error: "PDF contains insufficient extractable text. The PDF may be scanned or image-based. Please use a text-based PDF or enter data manually.",
          requiresManualEntry: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Extract invoice data from text
    const invoiceNumberMatch = text.match(/Invoice No:?\s*(\d+)/i) || 
                               text.match(/Invoice Number:?\s*(\d+)/i) ||
                               text.match(/Invoice\s+#?\s*:?\s*(\d+)/i);
    const invoiceNumber = invoiceNumberMatch?.[1] || "";

    const dateMatch = text.match(/Date:?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i) ||
                     text.match(/Date:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
                     text.match(/Invoice Date:?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i) ||
                     text.match(/Invoice Date:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const dateStr = dateMatch?.[1] || "";
    let invoiceDate = new Date().toISOString().split('T')[0];
    if (dateStr) {
      try {
        invoiceDate = new Date(dateStr).toISOString().split('T')[0];
      } catch (e) {
        // Use today if parsing fails
      }
    }

    const periodMatch = text.match(/(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\s*-\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/i) ||
                       text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
                       text.match(/Period:?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\s*-\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/i);
    let periodStart = new Date().toISOString().split('T')[0];
    let periodEnd = new Date().toISOString().split('T')[0];
    if (periodMatch?.[1] && periodMatch?.[2]) {
      try {
        periodStart = new Date(periodMatch[1]).toISOString().split('T')[0];
        periodEnd = new Date(periodMatch[2]).toISOString().split('T')[0];
      } catch (e) {
        // Use defaults if parsing fails
      }
    }

    const supplierMatch = text.match(/Supplier ID:?\s*(\d+)/i) ||
                         text.match(/Supplier\s+ID:?\s*(\d+)/i);
    const supplierId = supplierMatch?.[1] || "";

    const providerMatch = text.match(/YODEL|ROYAL MAIL|DPD|HERMES/i);
    const provider = providerMatch?.[0]?.toUpperCase() || "YODEL";

    const netTotalMatch = text.match(/Net Total[^\d]*£?\s*([\d,]+\.?\d*)/i) ||
                         text.match(/Net[^\d]*£?\s*([\d,]+\.?\d*)/i);
    const vatMatch = text.match(/VAT[^\d]*£?\s*([\d,]+\.?\d*)/i) ||
                    text.match(/V\.A\.T\.[^\d]*£?\s*([\d,]+\.?\d*)/i);
    const grossMatch = text.match(/Gross Total[^\d]*£?\s*([\d,]+\.?\d*)/i) ||
                      text.match(/Total[^\d]*£?\s*([\d,]+\.?\d*)/i) ||
                      text.match(/Grand Total[^\d]*£?\s*([\d,]+\.?\d*)/i);
    
    const netTotal = parseFloat(netTotalMatch?.[1]?.replace(/,/g, '') || '0');
    const vat = parseFloat(vatMatch?.[1]?.replace(/,/g, '') || '0');
    const grossTotal = parseFloat(grossMatch?.[1]?.replace(/,/g, '') || '0');

    // Return extracted data - client will handle detailed parsing of tables
    return new Response(
      JSON.stringify({
        invoiceNumber,
        invoiceDate,
        periodStart,
        periodEnd,
        supplierId,
        provider,
        netTotal,
        vat,
        grossTotal,
        rawText: text.substring(0, 50000), // First 50k chars for client-side parsing
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Parse invoice error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to parse invoice" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
  