import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_STAFF_ROLES = ['admin', 'hr', 'finance', 'dispatcher'];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("PROJECT_URL") ?? "";
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing PROJECT_URL/SERVICE_ROLE_KEY" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Identify caller
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const caller = userRes.user;

    // Verify caller is admin
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const hasAdminRole = (callerRoles || []).some((r) => r.role === "admin");
    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: "Only admins can create staff accounts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Parse body
    const body = await req.json();
    const {
      email,
      password,
      first_name,
      surname,
      role,
      contact_phone,
    } = body;

    // Validate required fields
    if (!email || !password || !first_name || !surname || !role) {
      return new Response(
        JSON.stringify({ error: "Email, password, first_name, surname, and role are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate role is allowed (NOT driver or onboarding)
    if (!ALLOWED_STAFF_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid role. Allowed roles: ${ALLOWED_STAFF_ROLES.join(", ")}. Drivers must be created through onboarding.` 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create full name
    const fullName = `${first_name} ${surname}`.trim();

    // Create user account with password change required
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: first_name.trim(),
        surname: surname.trim(),
        requires_password_change: true, // Force password change on first login
      },
    });

    if (createErr || !created?.user) {
      const msg = String(createErr?.message || "");
      if (msg.toLowerCase().includes("already") || createErr?.status === 422) {
        return new Response(
          JSON.stringify({ error: "User with this email already exists" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${msg}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Assign role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: role });

    if (roleErr) {
      // If role assignment fails, try to clean up the user
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return new Response(
        JSON.stringify({ error: `Failed to assign role: ${roleErr.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create/update profile with all personal information fields
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      user_id: created.user.id,
      first_name: first_name.trim(),
      surname: surname.trim(),
      full_name: fullName,
      email: email.trim().toLowerCase(),
      contact_phone: contact_phone?.trim() || null,
      address_line_1: null, // Can be updated later
      address_line_2: null, // Can be updated later
      address_line_3: null, // Can be updated later
      postcode: null, // Can be updated later
      emergency_contact_name: null, // Can be updated later
      emergency_contact_phone: null, // Can be updated later
    });

    if (profErr) {
      console.error("profiles upsert error", profErr);
      // Don't fail - profile can be updated later
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: created.user.id,
        email: email.trim().toLowerCase(),
        fullName: fullName,
        role: role,
        message: "Staff account created successfully. User must change password on first login.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("create-staff-account error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

