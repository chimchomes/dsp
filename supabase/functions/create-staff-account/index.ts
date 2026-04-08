import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_STAFF_ROLES = ['admin', 'hr', 'finance'];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid or expired token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const caller = userRes.user;

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", caller.id);
    const callerRoleList = (callerRoles || []).map((r: any) => r.role);
    const isMasterAdmin = callerRoleList.includes("master_admin");
    const hasAdminRole = callerRoleList.includes("admin");
    const hasHrRole = callerRoleList.includes("hr");
    if (!hasAdminRole && !hasHrRole && !isMasterAdmin) {
      return new Response(
        JSON.stringify({ error: "Only admins and HR can create staff accounts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, first_name, surname, role, contact_phone, tenant_id } = body;

    let resolvedTenantId = tenant_id;
    if (!resolvedTenantId) {
      const callerTenantRow = (callerRoles || []).find((r: any) => r.tenant_id);
      resolvedTenantId = callerTenantRow?.tenant_id;
    }

    if (!email || !password || !first_name || !surname || !role) {
      return new Response(
        JSON.stringify({ error: "Email, password, first_name, surname, and role are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!resolvedTenantId) {
      return new Response(
        JSON.stringify({ error: "Could not determine tenant. Pass tenant_id explicitly or ensure caller belongs to a tenant." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!ALLOWED_STAFF_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role. Allowed: ${ALLOWED_STAFF_ROLES.join(", ")}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const fullName = `${first_name} ${surname}`.trim();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: first_name.trim(),
        surname: surname.trim(),
        requires_password_change: true,
      },
    });

    if (createErr || !created?.user) {
      const msg = String(createErr?.message || "");
      if (msg.toLowerCase().includes("already") || (createErr as any)?.status === 422) {
        return new Response(
          JSON.stringify({ error: "A user with this email already exists" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${msg}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role, tenant_id: resolvedTenantId });

    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return new Response(
        JSON.stringify({ error: `Failed to assign role: ${roleErr.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { error: profErr } = await supabaseAdmin.from("staff_profiles").upsert({
      user_id: created.user.id,
      first_name: first_name.trim(),
      surname: surname.trim(),
      full_name: fullName,
      email: email.trim().toLowerCase(),
      contact_phone: contact_phone?.trim() || null,
      tenant_id: resolvedTenantId,
    });

    if (profErr) {
      console.error("staff_profiles upsert warning:", profErr.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: created.user.id,
        email: email.trim().toLowerCase(),
        fullName,
        role,
        message: "Staff account created. User must change password on first login.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("create-staff-account error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
