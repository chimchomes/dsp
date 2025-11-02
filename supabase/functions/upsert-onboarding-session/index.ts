import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const onboardingSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().max(200).optional(),
  ownershipType: z.enum(["own", "lease"]),
  sessionId: z.string().uuid().nullable().optional(),
  current_step: z.number().int().min(1).max(10).optional(),
  complete: z.boolean().optional(),
  data: z.object({
    address: z.string().max(500).optional(),
    contact_phone: z.string().max(20).optional(),
    emergency_contact_name: z.string().max(200).optional(),
    emergency_contact_phone: z.string().max(20).optional(),
    license_number: z.string().max(50).optional(),
    license_expiry: z.string().optional(),
    vehicle_make: z.string().max(100).optional(),
    vehicle_model: z.string().max(100).optional(),
    vehicle_year: z.union([z.number().int().min(1900).max(2100), z.string()]).optional(),
    vehicle_registration: z.string().max(50).optional(),
    preferred_vehicle_type: z.string().max(100).optional(),
    license_document_url: z.string().max(500).optional(),
    proof_of_address_url: z.string().max(500).optional(),
    right_to_work_url: z.string().max(500).optional(),
    vehicle_insurance_url: z.string().max(500).optional(),
    vehicle_registration_url: z.string().max(500).optional(),
  }).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
