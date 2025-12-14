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
      Deno.env.get('SUPABASE_URL') ?? Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '',
    )

    const { driver_id, period_start_date, period_end_date } = await req.json()

    if (!driver_id || !period_start_date || !period_end_date) {
      return new Response(
        JSON.stringify({ error: 'driver_id, period_start_date, and period_end_date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get driver info
    const { data: driver, error: driverError } = await supabaseClient
      .from('drivers')
      .select('id, name, email')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver) {
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // A. Performance Data: Sum packages_completed for the driver within date range
    const { data: routes, error: routesError } = await supabaseClient
      .from('routes')
      .select('parcels_delivered, dispatcher_id, dispatchers(driver_parcel_rate, default_deduction_rate)')
      .eq('driver_id', driver_id)
      .gte('scheduled_date', period_start_date)
      .lte('scheduled_date', period_end_date)

    if (routesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch routes', details: routesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalPackagesCompleted = 0
    let driverParcelRate = 0
    let defaultDeductionRate = 0

    if (routes && routes.length > 0) {
      // Sum packages completed
      totalPackagesCompleted = routes.reduce((sum, route) => {
        return sum + (route.parcels_delivered || 0)
      }, 0)

      // Get rate from first route's dispatcher (assuming all routes from same dispatcher)
      const firstRoute = routes[0]
      if (firstRoute.dispatcher_id && firstRoute.dispatchers) {
        const dispatcher = Array.isArray(firstRoute.dispatchers) 
          ? firstRoute.dispatchers[0] 
          : firstRoute.dispatchers
        driverParcelRate = Number(dispatcher?.driver_parcel_rate) || 0
        defaultDeductionRate = Number(dispatcher?.default_deduction_rate) || 0
      }
    }

    // B. Rate Data: Already fetched from dispatcher above
    // If no routes, try to get default rate from any dispatcher the driver might be associated with
    if (driverParcelRate === 0) {
      // Try to get from any active dispatcher as fallback
      const { data: defaultDispatcher } = await supabaseClient
        .from('dispatchers')
        .select('driver_parcel_rate, default_deduction_rate')
        .eq('active', true)
        .limit(1)
        .single()

      if (defaultDispatcher) {
        driverParcelRate = Number(defaultDispatcher.driver_parcel_rate) || 0
        defaultDeductionRate = Number(defaultDispatcher.default_deduction_rate) || 0
      }
    }

    // C. Expenses Data: Sum approved expenses for the driver within date range
    const { data: expenses, error: expensesError } = await supabaseClient
      .from('expenses')
      .select('cost')
      .eq('driver_id', driver_id)
      .eq('status', 'approved')
      .gte('created_at', period_start_date)
      .lte('created_at', period_end_date)

    if (expensesError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch expenses', details: expensesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const totalApprovedExpenses = expenses?.reduce((sum, expense) => {
      return sum + Number(expense.cost || 0)
    }, 0) || 0

    // Calculation
    const grossPay = totalPackagesCompleted * driverParcelRate
    const netPay = grossPay + totalApprovedExpenses - defaultDeductionRate

    // Build payslip object
    const payslip = {
      driver_details: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
      },
      period: {
        start: period_start_date,
        end: period_end_date,
      },
      performance: {
        total_packages_completed: totalPackagesCompleted,
        applied_rate: driverParcelRate,
      },
      financial: {
        gross_pay: grossPay,
        total_deductions: defaultDeductionRate,
        total_expenses: totalApprovedExpenses,
        net_pay: netPay,
      },
      breakdown: {
        earnings_from_parcels: grossPay,
        approved_expenses: totalApprovedExpenses,
        default_deductions: defaultDeductionRate,
      },
      generated_at: new Date().toISOString(),
    }

    return new Response(
      JSON.stringify(payslip),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

