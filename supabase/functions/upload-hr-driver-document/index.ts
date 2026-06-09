import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_FIELDS = new Set(["license_picture", "passport_upload", "photo_upload"]);

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
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const caller = userRes.user;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const hasPermission = roles?.some((r) => r.role === "admin" || r.role === "hr");
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Only admins and HR can upload driver documents" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
      );
    }

    const body = await req.json();
    const { fieldName, fileName, contentBase64, mimeType } = body as {
      fieldName?: string;
      fileName?: string;
      contentBase64?: string;
      mimeType?: string;
    };

    if (!fieldName || !ALLOWED_FIELDS.has(fieldName)) {
      throw new Error("Invalid fieldName");
    }
    if (!fileName || !contentBase64) {
      throw new Error("fileName and contentBase64 are required");
    }

    const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
    const filePath = `${caller.id}/draft-${fieldName}-${Date.now()}.${ext}`;

    const binary = Uint8Array.from(atob(contentBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([binary], { type: mimeType || "application/octet-stream" });

    const { error: uploadError } = await supabaseAdmin.storage
      .from("driver-documents")
      .upload(filePath, blob, { upsert: false, contentType: mimeType || undefined });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    return new Response(
      JSON.stringify({ path: filePath }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
