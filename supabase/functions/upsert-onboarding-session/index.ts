import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple rate limiting (in-memory - for production, use Redis or database)
// Rate limit: 5 requests per hour per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    // Create new record or reset expired one
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

function getClientIP(req: Request): string {
  // Try to get real IP from various headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  // Fallback (for local development)
  return "unknown";
}

// Input validation schema
const onboardingSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().max(200).optional(),
  ownershipType: z.enum(["own", "lease"]),
  sessionId: z.string().uuid().nullable().optional(),
  current_step: z.number().int().min(1).max(10).optional(),
  complete: z.boolean().optional(),
  data: z.object({
    // Personal Details
    first_name: z.string().max(100).optional(),
    surname: z.string().max(100).optional(),
    full_name: z.string().max(200).optional(),
    contact_phone: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
    address_line_1: z.string().max(200).optional(),
    address_line_2: z.string().max(200).optional(),
    address_line_3: z.string().max(200).optional(),
    post_code: z.string().max(20).optional(),
    emergency_contact_name: z.string().max(100).optional(),
    emergency_contact_phone: z.string().max(20).optional(),
    
    // Driver's License
    drivers_license_number: z.string().max(50).optional(),
    license_number: z.string().max(50).optional(), // Legacy field
    license_expiry_date: z.string().optional(),
    license_expiry: z.string().optional(), // Legacy field
    license_picture: z.string().max(500).optional(),
    license_document_url: z.string().max(500).optional(), // Legacy field
    
    // Right to Work
    national_insurance_number: z.string().max(20).optional(),
    passport_upload: z.string().max(500).optional(),
    passport_number: z.string().max(50).optional(),
    passport_expiry_date: z.string().optional(),
    right_to_work_url: z.string().max(500).optional(), // Legacy field
    
    // Vehicle Details (Own Vehicle)
    vehicle_make: z.string().max(100).optional(),
    vehicle_model: z.string().max(100).optional(),
    vehicle_year: z.union([z.number().int().min(1900).max(2100), z.string()]).optional(),
    vehicle_registration_number: z.string().max(50).optional(),
    vehicle_registration: z.string().max(50).optional(), // Legacy field
    vehicle_type: z.string().max(100).optional(),
    vehicle_mileage: z.union([z.number().int().min(0), z.string()]).optional(),
    
    // Leased Vehicle Details
    leased_vehicle_type1: z.string().max(100).optional(),
    leased_vehicle_type2: z.string().max(100).optional(),
    leased_vehicle_type3: z.string().max(100).optional(),
    preferred_vehicle_type: z.string().max(100).optional(), // Legacy field
    lease_start_date: z.string().optional(),
    
    // Identity
    photo_upload: z.string().max(500).optional(),
    dvla_code: z.string().max(50).optional(),
    dbs_check: z.boolean().optional(),
    
    // Work Availability
    driver_availability: z.string().max(50).optional(),
    
    // Legacy fields
    proof_of_address_url: z.string().max(500).optional(),
    vehicle_insurance_url: z.string().max(500).optional(),
    vehicle_registration_url: z.string().max(500).optional(),
  }).passthrough().optional(), // Use passthrough to allow additional fields
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000) // seconds
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" }, 
          status: 429 
        }
      );
    }

    const body = await req.json();
    
    // Validate input
    const validatedData = onboardingSchema.parse(body);
    
    const {
      email,
      fullName,
      ownershipType,
      sessionId,
      current_step,
      data = {},
      complete = false,
    } = validatedData;

    const supabaseAdmin = createClient(
      Deno.env.get("PROJECT_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // 1) Ensure user exists or create it
    let targetUserId: string | null = null;
    let createdUser = false;

    // Try to list users and find by email
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) {
      console.error("listUsers error", listErr);
    }
    targetUserId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;

    if (!targetUserId) {
      // Generate a secure random password
      const tempPassword = crypto.randomUUID() + crypto.randomUUID();
      
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName ?? null,
          requires_password_change: true,
        },
      });
      if (createErr) {
        // In case of race/exists, try to find again
        const { data: list2 } = await supabaseAdmin.auth.admin.listUsers();
        targetUserId = list2?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
        if (!targetUserId) throw createErr;
      } else {
        targetUserId = created!.user.id;
        createdUser = true;
        // assign onboarding role (idempotent via DO NOTHING on conflict in DB)
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: targetUserId, role: "onboarding" });
        if (roleErr) console.error("role insert error", roleErr);
      }
    }

    if (!targetUserId) {
      throw new Error("Unable to resolve user id for email");
    }

    // Prepare session payload with validated data
    const payload: Record<string, unknown> = {
      user_id: targetUserId,
      vehicle_ownership_type: ownershipType,
      current_step: current_step ?? 1,
      email: email,
      full_name: fullName || data.full_name || null,
      ...data,
    };

    // Coerce numeric/year if provided as string
    if (typeof payload["vehicle_year"] === "string") {
      const n = parseInt(String(payload["vehicle_year"]), 10);
      payload["vehicle_year"] = Number.isFinite(n) ? n : null;
    }

    if (complete) {
      payload["status"] = "submitted";
      payload["completed"] = true;
      payload["completed_at"] = new Date().toISOString();
    }

    // 2) Upsert onboarding session (update if id provided, else insert new)
    let resultingSessionId: string | null = sessionId ?? null;

    if (sessionId) {
      const { error: updErr } = await supabaseAdmin
        .from("onboarding_sessions")
        .update(payload)
        .eq("id", sessionId);
      if (updErr) throw updErr;
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("onboarding_sessions")
        .insert(payload)
        .select("id")
        .single();
      if (insErr) throw insErr;
      resultingSessionId = inserted.id;
    }

    return new Response(
      JSON.stringify({
        userId: targetUserId,
        sessionId: resultingSessionId,
        createdUser,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("upsert-onboarding-session error", error);
    
    // Provide user-friendly error message without exposing internal details
    const errorMessage = error instanceof z.ZodError
      ? "Invalid input data provided"
      : "An error occurred while processing your request";
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
