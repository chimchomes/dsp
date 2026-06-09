import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { assertDriverOnboardingFields } from "../_shared/ukValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOC_FIELDS = ["license_picture", "passport_upload", "photo_upload"] as const;

async function copyDocToProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  fromPath: string,
  driverProfileId: string,
  column: string,
): Promise<string | null> {
  const ext = fromPath.split(".").pop() || "bin";
  const toPath = `${driverProfileId}/${column}.${ext}`;
  const { data, error: dlErr } = await supabaseAdmin.storage.from("driver-documents").download(fromPath);
  if (dlErr || !data) return null;
  const { error: upErr } = await supabaseAdmin.storage
    .from("driver-documents")
    .upload(toPath, data, { upsert: true });
  if (upErr) return null;
  return toPath;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }
    const token = authHeader.replace("Bearer ", "").trim();

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const hasPermission = roles?.some((r) => r.role === "admin" || r.role === "hr");
    if (!hasPermission) {
      throw new Error("Only admins and HR can create driver accounts");
    }

    const body = await req.json();
    const {
      firstName,
      surname,
      email,
      password,
      contactPhone,
      licenseNumber,
      licenseExpiry,
      addressLine1,
      addressLine2,
      addressLine3,
      postcode,
      emergencyContactName,
      emergencyContactPhone,
      operatorId,
      nationalInsurance,
      passportNumber,
      passportExpiry,
      dvlaCode,
      dbsCheck,
      driverAvailability,
      tenant_id: explicitTenantId,
      licensePicturePath,
      passportUploadPath,
      photoUploadPath,
    } = body;

    let tenantId = explicitTenantId;
    if (!tenantId) {
      const { data: callerTenant } = await supabaseAdmin
        .from("user_roles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .not("tenant_id", "is", null)
        .limit(1)
        .single();
      tenantId = callerTenant?.tenant_id;
    }
    if (!tenantId) {
      throw new Error("tenant_id is required");
    }

    if (!firstName || !surname || !email || !password) {
      throw new Error("First name, surname, email, and password are required");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    assertDriverOnboardingFields({
      email,
      postCode: postcode,
      contactPhone,
      emergencyContactPhone,
      licenseNumber,
      nationalInsurance,
      passportNumber,
      dvlaCode,
    });

    const draftPaths = [licensePicturePath, passportUploadPath, photoUploadPath].filter(Boolean) as string[];
    for (const p of draftPaths) {
      if (!p.startsWith(`${user.id}/`)) {
        throw new Error("Invalid document path");
      }
    }

    const fullName = `${firstName} ${surname}`.trim();

    const normDate = (v: unknown): string | null => {
      if (v === null || v === undefined || v === "") return null;
      const s = String(v).trim();
      if (!s) return null;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().split("T")[0];
    };

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: fullName,
        first_name: firstName,
        surname,
        requires_password_change: true,
      },
    });

    if (createError || !newUser.user) {
      throw new Error(`Failed to create user: ${createError?.message}`);
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: "driver",
        tenant_id: tenantId,
      });

    if (roleError) {
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    const { error: profileError } = await supabaseAdmin
      .from("staff_profiles")
      .upsert({
        user_id: newUser.user.id,
        email,
        first_name: firstName,
        surname,
        full_name: fullName,
        contact_phone: contactPhone || null,
        address_line_1: addressLine1 || null,
        address_line_2: addressLine2 || null,
        address_line_3: addressLine3 || null,
        postcode: postcode || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (profileError) {
      console.error("Profile creation error:", profileError);
    }

    const { data: driverRow, error: driverError } = await supabaseAdmin
      .from("driver_profiles")
      .insert({
        user_id: newUser.user.id,
        email,
        name: fullName,
        first_name: firstName,
        surname,
        contact_phone: contactPhone || null,
        address_line_1: addressLine1 || null,
        address_line_2: addressLine2 || null,
        address_line_3: addressLine3 || null,
        postcode: postcode || null,
        license_number: licenseNumber || null,
        license_expiry: normDate(licenseExpiry),
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        operator_id: operatorId || null,
        national_insurance: nationalInsurance || null,
        passport_number: passportNumber || null,
        passport_expiry: normDate(passportExpiry),
        dvla_code: dvlaCode || null,
        dbs_check: typeof dbsCheck === "boolean" ? dbsCheck : false,
        driver_availability: driverAvailability || null,
        onboarded_by: user.id,
        onboarded_at: new Date().toISOString(),
        active: true,
        tenant_id: tenantId,
      })
      .select("id")
      .single();

    if (driverError || !driverRow?.id) {
      throw new Error(`Failed to create driver record: ${driverError?.message ?? "unknown"}`);
    }

    const docInputs: Record<string, string | undefined> = {
      license_picture: licensePicturePath,
      passport_upload: passportUploadPath,
      photo_upload: photoUploadPath,
    };

    const docUpdates: Record<string, string> = {};
    for (const field of DOC_FIELDS) {
      const fromPath = docInputs[field];
      if (!fromPath) continue;
      const finalPath = await copyDocToProfile(supabaseAdmin, fromPath, driverRow.id, field);
      if (finalPath) docUpdates[field] = finalPath;
    }

    if (Object.keys(docUpdates).length > 0) {
      const { error: docUpdateError } = await supabaseAdmin
        .from("driver_profiles")
        .update({ ...docUpdates, updated_at: new Date().toISOString() })
        .eq("id", driverRow.id);
      if (docUpdateError) {
        console.error("Document path update error:", docUpdateError);
      }
    }

    try {
      await supabaseAdmin.rpc("log_activity", {
        p_action_type: "driver_created",
        p_resource_type: "driver",
        p_resource_id: newUser.user.id,
        p_action_details: {
          name: fullName,
          email,
          created_by_user_id: user.id,
          created_by_email: user.email,
          tenant_id: tenantId,
          source: "admin_or_hr_create_driver_account",
        },
      });
    } catch (logError) {
      console.error("Activity log error:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: newUser.user.id,
        driverProfileId: driverRow.id,
        email,
        message: "Driver account created successfully. The driver must change their password on first login.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Create driver account error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
