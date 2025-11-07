import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({} as any));

    // Primary expected payload from UI
    const email: string | undefined = body?.email?.toString().trim();
    const fullName: string | undefined = body?.fullName?.toString().trim();
    const firstName: string | undefined = body?.firstName?.toString().trim();
    const surname: string | undefined = body?.surname?.toString().trim();
    const providedPassword: string | undefined = body?.password?.toString();

    // Backward-compat fallback (older callers provided role/password)
    const role: string | undefined = body?.role?.toString().trim();

    const url = Deno.env.get("PROJECT_URL") ?? "";
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Service configuration missing (PROJECT_URL/SERVICE_ROLE_KEY)." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // If email provided (new UI flow)
    if (email) {
      const passwordToUse = providedPassword && providedPassword.length >= 8 ? providedPassword : "Password123";

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: passwordToUse,
        email_confirm: true,
        user_metadata: {
          full_name: fullName ?? null,
          first_name: firstName ?? null,
          surname: surname ?? null,
          requires_password_change: false,
        },
      });
      if (createErr || !created?.user) {
        const msg = String(createErr?.message || "");
        if (msg.toLowerCase().includes("already") || createErr?.status === 422) {
          return new Response(
            JSON.stringify({ exists: true, email }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        throw createErr ?? new Error("Failed to create user");
      }

      // Assign onboarding role (idempotent in DB if constrained)
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "onboarding" });
      if (roleErr) {
        // log but don't fail account creation
        console.error("role insert error", roleErr);
      }

      // Upsert profile for friendly names
      const { error: profErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          user_id: created.user.id,
          first_name: firstName ?? null,
          surname: surname ?? null,
          full_name: fullName ?? null,
          email: email
        });
      if (profErr) console.error('profiles upsert error', profErr);

      return new Response(
        JSON.stringify({ exists: false, userId: created.user.id, email, fullName: fullName ?? null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Legacy role/password flow (kept for compatibility with older tools)
    if (!role || !providedPassword) {
      return new Response(
        JSON.stringify({ error: "Email and fullName are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Generate a role-based test email if only role/password provided
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const usersWithRole = existingUsers?.users.filter((u) =>
      u.email?.startsWith(`${role}`) && u.email?.endsWith("@test.com")
    ) || [];

    let nextNumber = 1;
    if (usersWithRole.length > 0) {
      const numbers = usersWithRole
        .map((u) => {
          const match = u.email?.match(new RegExp(`${role}(\\d+)@test\\.com`));
          return match ? parseInt(match[1]) : 0;
        })
        .filter((n) => !isNaN(n));
      if (numbers.length > 0) nextNumber = Math.max(...numbers) + 1;
    }

    const generatedFullName = `${role}${nextNumber}`;
    const generatedEmail = `${role}${nextNumber}@test.com`;

    const emailExists = existingUsers?.users.some((u) => u.email === generatedEmail);
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "Generated email already exists, please try again" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: generatedEmail,
      password: providedPassword,
      email_confirm: true,
      user_metadata: { full_name: generatedFullName },
    });
    if (createError || !newUser?.user) throw createError ?? new Error("Failed to create user");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUser.user.id, role });
    if (roleError) throw roleError;

    // create minimal profile
    const { error: profErr2 } = await supabaseAdmin
      .from('profiles')
      .upsert({ user_id: newUser.user.id, full_name: generatedFullName, email: generatedEmail });
    if (profErr2) console.error('profiles upsert error', profErr2);

    return new Response(
      JSON.stringify({ message: "Account created successfully", userId: newUser.user.id, email: generatedEmail, fullName: generatedFullName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("create-onboarding-account error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
