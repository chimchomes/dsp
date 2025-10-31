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
    const { role, password } = await req.json();

    if (!role || !password) {
      return new Response(
        JSON.stringify({ error: "Role and password are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get all existing users with this role to determine the next number
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const usersWithRole = existingUsers?.users.filter((u) => 
      u.email?.startsWith(`${role}`) && u.email?.endsWith("@test.com")
    ) || [];

    // Find the highest number for this role
    let nextNumber = 1;
    if (usersWithRole.length > 0) {
      const numbers = usersWithRole
        .map((u) => {
          const match = u.email?.match(new RegExp(`${role}(\\d+)@test\\.com`));
          return match ? parseInt(match[1]) : 0;
        })
        .filter((n) => !isNaN(n));
      
      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    const fullName = `${role}${nextNumber}`;
    const email = `${role}${nextNumber}@test.com`;

    // Check if this specific email already exists
    const emailExists = existingUsers?.users.some((u) => u.email === email);
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "Generated email already exists, please try again" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) throw createError;

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role,
      });

    if (roleError) throw roleError;

    return new Response(
      JSON.stringify({
        message: "Account created successfully",
        userId: newUser.user.id,
        email: email,
        fullName: fullName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
