import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("PROJECT_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { invoice_number } = await req.json();

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // Get invoices to process
    let invoicesQuery = supabaseAdmin
      .from("invoices")
      .select("invoice_number, invoice_date, period_start, period_end");

    if (invoice_number) {
      invoicesQuery = invoicesQuery.eq("invoice_number", invoice_number);
    }

    const { data: invoices, error: invoicesError } = await invoicesQuery;
    if (invoicesError) throw invoicesError;
    if (!invoices || invoices.length === 0) {
      throw new Error("No invoices found");
    }

    const generatedPayslips = [];
    const warnings: string[] = [];

    for (const invoice of invoices) {
      // Get weekly pay data for this invoice
      const { data: weeklyPay, error: weeklyPayError } = await supabaseAdmin
        .from("weekly_pay")
        .select("*")
        .eq("invoice_number", invoice.invoice_number);

      if (weeklyPayError) throw weeklyPayError;

      // Group by operator
      const operatorGroups = new Map<string, any[]>();
      weeklyPay?.forEach((wp) => {
        if (!operatorGroups.has(wp.operator_id)) {
          operatorGroups.set(wp.operator_id, []);
        }
        operatorGroups.get(wp.operator_id)?.push(wp);
      });

      // Generate payslip for each operator
      for (const [operatorId, payData] of operatorGroups.entries()) {
        // Find driver by operator_id
        const { data: driver, error: driverError } = await supabaseAdmin
          .from("drivers")
          .select("id")
          .eq("operator_id", operatorId)
          .single();

        if (driverError || !driver) {
          warnings.push(`No driver found for operator ${operatorId} - skipping`);
          console.warn(`No driver found for operator ${operatorId}`);
          continue;
        }

        // Get driver rate from driver_rates table (use most recent rate for the invoice period)
        // Query by operator_id since invoices use operator_id
        const { data: driverRate, error: rateError } = await supabaseAdmin
          .from("driver_rates")
          .select("rate")
          .eq("operator_id", operatorId)
          .lte("effective_date", invoice.period_end || invoice.invoice_date)
          .order("effective_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rateError) {
          warnings.push(`Error fetching rate for operator ${operatorId}: ${rateError.message}`);
          console.warn(`Error fetching rate for operator ${operatorId}:`, rateError);
        }

        const driverRateValue = driverRate?.rate || null;

        // If no driver rate found, skip this operator (don't create payslip with 0 pay)
        if (!driverRateValue || driverRateValue === 0) {
          warnings.push(`No valid driver rate found for operator ${operatorId} - skipping payslip generation`);
          console.warn(`No valid driver rate found for operator ${operatorId}`);
          continue;
        }

        // Calculate gross pay from daily_pay using driver rates (not invoice rates)
        // Use qty from daily_pay and multiply by driver rate from driver_rates table
        let grossPay = 0;
        // Read total_qty from the new DAILY_PAY_QTY table
        const { data: dailyPayQty, error: dailyPayQtyError } = await supabaseAdmin
          .from("DAILY_PAY_QTY") // Changed to UPPERCASE table name
          .select("total_qty")  // Changed to select total_qty
          .eq("invoice_number", invoice.invoice_number)
          .eq("operator_id", operatorId);

        if (dailyPayQtyError) throw dailyPayQtyError;

        if (!dailyPayQty || dailyPayQty.length === 0) {
          warnings.push(`No DAILY_PAY_QTY data found for operator ${operatorId} - gross pay will be 0`);
        }

        // Sum up total_qty and multiply by driver rate
        dailyPayQty?.forEach((dpq) => {
          const totalQty = dpq.total_qty || 0;
          if (totalQty > 0 && driverRateValue) {
            grossPay += (totalQty * parseFloat(driverRateValue.toString()));
          }
        });

        // Get deductions (manual adjustments from invoice)
        // For now, deductions = 0, will be calculated from manual_adjustments table if needed
        const deductions = 0;

        const netPay = grossPay - deductions;

        // Check if payslip already exists
        const { data: existingPayslip } = await supabaseAdmin
          .from("payslips")
          .select("id")
          .eq("driver_id", driver.id)
          .eq("invoice_number", invoice.invoice_number)
          .maybeSingle();

        if (existingPayslip) {
          // Update existing payslip
          const { error: updateError } = await supabaseAdmin
            .from("payslips")
            .update({
              gross_pay: grossPay,
              deductions: deductions,
              net_pay: netPay,
              generated_by: user.id,
              generated_at: new Date().toISOString(),
            })
            .eq("id", existingPayslip.id);

          if (updateError) throw updateError;
          generatedPayslips.push({ driver_id: driver.id, invoice_number: invoice.invoice_number, updated: true });
        } else {
          // Create new payslip
          const { error: insertError } = await supabaseAdmin
            .from("payslips")
            .insert({
              driver_id: driver.id,
              invoice_number: invoice.invoice_number,
              invoice_date: invoice.invoice_date,
              period_start: invoice.period_start,
              period_end: invoice.period_end,
              operator_id: operatorId,
              gross_pay: grossPay,
              deductions: deductions,
              net_pay: netPay,
              generated_by: user.id,
            });

          if (insertError) throw insertError;
          generatedPayslips.push({ driver_id: driver.id, invoice_number: invoice.invoice_number, created: true });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payslips_generated: generatedPayslips.length,
        payslips: generatedPayslips,
        warnings: warnings.length > 0 ? warnings : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
