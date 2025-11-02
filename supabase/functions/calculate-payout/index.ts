import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { driver_id, period_start, period_end } = await req.json()

    console.log('Calculate payout for driver:', driver_id)

    // Get earnings for the period
    let earningsQuery = supabaseClient
      .from('earnings')
      .select('gross_amount')
      .eq('driver_id', driver_id)

    if (period_start) {
      earningsQuery = earningsQuery.gte('week_start_date', period_start)
    }
    if (period_end) {
      earningsQuery = earningsQuery.lte('week_end_date', period_end)
    }

    // Calculate earnings from completed routes with DSP payment logic
    const { data: completedRoutes, error: routesError } = await supabaseClient
      .from('routes')
      .select('parcel_count_total, parcels_delivered, amazon_rate_per_parcel, dispatcher_id, dispatchers(admin_commission_percentage)')
      .eq('driver_id', driver_id)
      .eq('status', 'completed')
      .gte('scheduled_date', period_start || '1970-01-01')
      .lte('scheduled_date', period_end || '2099-12-31')

    if (routesError) console.error('Routes error:', routesError)

    // Calculate gross earnings based on DSP payment logic
    let grossEarnings = 0
    let adminCutTotal = 0

    if (completedRoutes && completedRoutes.length > 0) {
      for (const route of completedRoutes) {
        const parcelsDelivered = route.parcels_delivered || route.parcel_count_total || 0
        const amazonRate = Number(route.amazon_rate_per_parcel) || 0
        
        // DSP Revenue = parcels_delivered * amazon_rate_per_parcel
        const dspRevenue = parcelsDelivered * amazonRate
        
        // Admin Cut from dispatcher commission
        let adminCut = 0
        if (route.dispatcher_id && route.dispatchers) {
          const dispatcher = Array.isArray(route.dispatchers) ? route.dispatchers[0] : route.dispatchers
          const adminCommission = Number(dispatcher?.admin_commission_percentage) || 0
          adminCut = parcelsDelivered * adminCommission
        }
        
        grossEarnings += dspRevenue
        adminCutTotal += adminCut
      }
    }

    // Also check legacy earnings table for backward compatibility
    const { data: earnings, error: earningsError } = await earningsQuery

    if (earningsError) throw earningsError

    const legacyGross = earnings?.reduce(
      (sum, e) => sum + Number(e.gross_amount),
      0
    ) || 0

    grossEarnings += legacyGross

    // Get deductions for the period
    let deductionsQuery = supabaseClient
      .from('deductions')
      .select('amount')
      .eq('driver_id', driver_id)

    if (period_start) {
      deductionsQuery = deductionsQuery.gte('created_at', period_start)
    }
    if (period_end) {
      deductionsQuery = deductionsQuery.lte('created_at', period_end)
    }

    const { data: deductions, error: deductionsError } = await deductionsQuery

    if (deductionsError) throw deductionsError

    const totalDeductions = deductions?.reduce(
      (sum, d) => sum + Number(d.amount),
      0
    ) || 0

    // Calculate net payout: Gross - Admin Cut - Deductions
    const netPayout = grossEarnings - adminCutTotal - totalDeductions

    // Create pay statement
    const { data: payStatement, error: payStatementError } = await supabaseClient
      .from('pay_statements')
      .insert({
        driver_id,
        period_start: period_start || new Date().toISOString().split('T')[0],
        period_end: period_end || new Date().toISOString().split('T')[0],
        gross_earnings: grossEarnings,
        total_deductions: totalDeductions,
        net_payout: netPayout,
        status: 'pending',
      })
      .select()
      .single()

    if (payStatementError) throw payStatementError

    console.log('Pay statement created:', payStatement.id)

    return new Response(
      JSON.stringify({
        success: true,
        pay_statement: payStatement,
        gross_earnings: grossEarnings,
        admin_cut: adminCutTotal,
        total_deductions: totalDeductions,
        net_payout: netPayout,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error calculating payout:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
