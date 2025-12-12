import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Stop {
  street_address: string;
  customer_name?: string;
  package_details?: string;
  stop_sequence: number;
}

interface ParsedRouteData {
  tour_id: string;
  stops: Stop[];
  parcel_count_total?: number;
  scheduled_date?: string;
}

// Simple CSV parser
function parseCSV(csvText: string): ParsedRouteData | null {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const stops: Stop[] = [];

  // Expected CSV format: address, customer_name, package_details (optional columns)
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const addressIndex = headers.findIndex(h => h.includes('address') || h.includes('street'));
    const customerIndex = headers.findIndex(h => h.includes('customer') || h.includes('name'));
    const packageIndex = headers.findIndex(h => h.includes('package') || h.includes('parcel'));

    if (addressIndex >= 0 && values[addressIndex]) {
      stops.push({
        street_address: values[addressIndex],
        customer_name: customerIndex >= 0 ? values[customerIndex] : undefined,
        package_details: packageIndex >= 0 ? values[packageIndex] : undefined,
        stop_sequence: stops.length + 1,
      });
    }
  }

  if (stops.length === 0) return null;

  // Extract tour_id from first line or generate
  const tourIdMatch = csvText.match(/tour[_\s]*id[:\s]*([^\n,]+)/i);
  const tour_id = tourIdMatch ? tourIdMatch[1].trim() : `ROUTE_${Date.now()}`;

  return {
    tour_id,
    stops,
    parcel_count_total: stops.length,
  };
}

// Geocoding function using a simple geocoding service
// Note: In production, replace with Google Maps Geocoding API or similar
async function geocodeAddress(address: string, retries = 2): Promise<{ lat: number; lng: number } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Using a free geocoding service (Nominatim) - replace with production service
      const encodedAddress = encodeURIComponent(address);
      
      // Add timeout and better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
        {
          headers: {
            'User-Agent': 'DSP-Route-Ingestion/1.0',
            'Accept': 'application/json'
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < retries) continue; // Retry on HTTP errors
        return null;
      }

      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      
      // If no results, don't retry
      return null;
    } catch (error) {
      // Log error but don't fail the entire import
      console.error(`Geocoding error (attempt ${attempt + 1}/${retries + 1}) for "${address}":`, error);
      
      // If it's the last attempt, return null (geocoding failed but continue)
      if (attempt === retries) {
        return null;
      }
      
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  return null;
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

    const { dispatcher_id, file_content, file_type, tour_id, scheduled_date } = await req.json()

    if (!dispatcher_id) {
      return new Response(
        JSON.stringify({ error: 'dispatcher_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get dispatcher info
    const { data: dispatcher, error: dispatcherError } = await supabaseClient
      .from('dispatchers')
      .select('tour_id_prefix, driver_parcel_rate')
      .eq('id', dispatcher_id)
      .single()

    if (dispatcherError || !dispatcher) {
      return new Response(
        JSON.stringify({ error: 'Dispatcher not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse the file
    let parsedData: ParsedRouteData | null = null;

    if (file_type === 'csv' || file_type === 'text/csv') {
      parsedData = parseCSV(file_content);
    } else {
      // For PDF, we'd need a PDF parsing service
      // For now, return error suggesting CSV
      return new Response(
        JSON.stringify({ error: 'PDF parsing not yet implemented. Please use CSV format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!parsedData || parsedData.stops.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to parse file or no stops found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate tour_id with prefix if available
    const finalTourId = dispatcher.tour_id_prefix 
      ? `${dispatcher.tour_id_prefix}${parsedData.tour_id}`
      : parsedData.tour_id;

    // Geocode all addresses (with error handling - don't fail entire import if geocoding fails)
    const geocodedStops = await Promise.allSettled(
      parsedData.stops.map(async (stop) => {
        try {
          const coords = await geocodeAddress(stop.street_address);
          return {
            ...stop,
            latitude: coords?.lat || null,
            longitude: coords?.lng || null,
            geocoded: !!coords,
            geocoding_error: coords ? null : 'Failed to geocode address',
          };
        } catch (error) {
          // If geocoding fails completely, still create the stop without coordinates
          console.error(`Failed to geocode stop ${stop.stop_sequence}:`, error);
          return {
            ...stop,
            latitude: null,
            longitude: null,
            geocoded: false,
            geocoding_error: 'Geocoding service unavailable',
          };
        }
      })
    );

    // Extract successful results, handle failures gracefully
    const stops = geocodedStops.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // If promise was rejected, create stop without geocoding
        const originalStop = parsedData.stops[index];
        return {
          ...originalStop,
          latitude: null,
          longitude: null,
          geocoded: false,
          geocoding_error: 'Geocoding failed',
        };
      }
    });

    // Create route object (driver_id can be null for unassigned routes)
    const { data: route, error: routeError } = await supabaseClient
      .from('routes')
      .insert({
        dispatcher_id,
        tour_id: finalTourId,
        customer_name: finalTourId,
        address: parsedData.stops[0]?.street_address || 'Multiple stops',
        scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
        status: 'pending',
        time_window: 'TBD',
        parcel_count_total: parsedData.parcel_count_total || parsedData.stops.length,
        parcels_delivered: 0,
        driver_id: null, // Will be assigned later - null is allowed after migration
      })
      .select()
      .single()

    if (routeError || !route) {
      return new Response(
        JSON.stringify({ error: 'Failed to create route', details: routeError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create stops
    const stopsToInsert = stops.map(stop => ({
      route_id: route.id,
      stop_sequence: stop.stop_sequence,
      street_address: stop.street_address,
      customer_name: stop.customer_name,
      package_details: stop.package_details,
      latitude: stop.latitude,
      longitude: stop.longitude,
      geocoded: stop.geocoded,
      geocoding_error: stop.geocoding_error,
    }))

    const { error: stopsError } = await supabaseClient
      .from('stops')
      .insert(stopsToInsert)

    if (stopsError) {
      // Rollback route creation
      await supabaseClient.from('routes').delete().eq('id', route.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create stops', details: stopsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geocodedCount = stops.filter(s => s.geocoded).length;
    
    return new Response(
      JSON.stringify({
        success: true,
        route_id: route.id,
        tour_id: finalTourId,
        stops_created: stops.length,
        geocoded_count: geocodedCount,
        warning: geocodedCount < stops.length 
          ? `Some addresses could not be geocoded (${stops.length - geocodedCount} failed). Route created successfully.`
          : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

