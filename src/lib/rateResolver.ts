import { supabase } from "@/integrations/supabase/client";

export interface ResolvedRate {
  applied_rate: number;
  rate_source: "driver_override" | "tour_rate" | "none";
  matched_key: string;
}

/**
 * Resolve the applicable pay rate for a driver on a specific tour and date.
 *
 * Priority:
 *   1. driver_rates override (by driver_id, effective_date <= asOfDate)
 *   2. driver_rates override (by operator_id fallback)
 *   3. tour_rates default   (by tour_id, effective_date <= asOfDate)
 *   4. Returns rate 0 with source "none" if nothing found
 */
export async function resolveRate(
  tenantId: string,
  driverId: string,
  operatorId: string,
  tourId: string,
  asOfDate: string
): Promise<ResolvedRate> {
  // 1. driver_rates override by driver_id
  const { data: driverRate } = await supabase
    .from("driver_rates")
    .select("rate, effective_date")
    .eq("driver_id", driverId)
    .lte("effective_date", asOfDate)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (driverRate?.rate != null) {
    return {
      applied_rate: parseFloat(driverRate.rate.toString()),
      rate_source: "driver_override",
      matched_key: driverId,
    };
  }

  // 1b. driver_rates override by operator_id
  if (operatorId) {
    const { data: opRate } = await supabase
      .from("driver_rates")
      .select("rate, effective_date")
      .eq("operator_id", operatorId)
      .lte("effective_date", asOfDate)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (opRate?.rate != null) {
      return {
        applied_rate: parseFloat(opRate.rate.toString()),
        rate_source: "driver_override",
        matched_key: operatorId,
      };
    }
  }

  // 2. tour_rates fallback
  if (tourId) {
    const { data: tourRate } = await supabase
      .from("tour_rates")
      .select("rate, effective_date")
      .eq("tour_id", tourId)
      .lte("effective_date", asOfDate)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tourRate?.rate != null) {
      return {
        applied_rate: parseFloat(tourRate.rate.toString()),
        rate_source: "tour_rate",
        matched_key: tourId,
      };
    }
  }

  // 3. No rate found
  return { applied_rate: 0, rate_source: "none", matched_key: "" };
}

/**
 * Batch-resolve rates for multiple tour rows belonging to a single driver.
 * Returns a map of tourId -> ResolvedRate, plus a combined gross pay.
 */
export async function resolveRatesForDriver(
  tenantId: string,
  driverId: string,
  operatorId: string,
  tourRows: { tour: string; totalQty: number }[],
  asOfDate: string
): Promise<{
  perTour: Record<string, ResolvedRate>;
  grossPay: number;
  missingTours: string[];
}> {
  const perTour: Record<string, ResolvedRate> = {};
  const missingTours: string[] = [];
  let grossPay = 0;

  const uniqueTours = [...new Set(tourRows.map((r) => r.tour))];

  for (const tourId of uniqueTours) {
    const resolved = await resolveRate(tenantId, driverId, operatorId, tourId, asOfDate);
    perTour[tourId] = resolved;
    if (resolved.rate_source === "none") {
      missingTours.push(tourId);
    }
  }

  for (const row of tourRows) {
    const rate = perTour[row.tour];
    if (rate && rate.rate_source !== "none") {
      grossPay += row.totalQty * rate.applied_rate;
    }
  }

  return { perTour, grossPay, missingTours };
}
