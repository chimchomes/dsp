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
    const url = Deno.env.get("PROJECT_URL") ?? "";
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing PROJECT_URL/SERVICE_ROLE_KEY" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
    }

    const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Identify caller
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });

    const caller = userRes.user;

    // Parse body
    const { title, body: content, kind = 'message', driverIds, recipientId, recipientIds, recipientRole } = await req.json();
    if (!title || !content) return new Response(JSON.stringify({ error: "title and body are required" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });

    // Determine caller roles
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);
    const callerRoles = (roleRows || []).map((r) => String(r.role));
    if (callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "User has no role assigned" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
    }

    const hasRole = (role: string) => callerRoles.includes(role);
    const hasDriverRole = hasRole('driver');
    const isDriverOnly = hasDriverRole && callerRoles.every((role) => role === 'driver');
    const isOnboarding = hasRole('onboarding');
    const isInactive = hasRole('inactive');
    const requestedRole = typeof recipientRole === 'string' && recipientRole.trim().length > 0
      ? recipientRole.trim()
      : undefined;

    let recipients: string[] = [];

    if (Array.isArray(recipientIds) && recipientIds.length > 0) {
      recipients = recipientIds.map(String);
    }
    if (recipientId) {
      recipients.push(String(recipientId));
    }
    if (Array.isArray(driverIds) && driverIds.length > 0) {
      recipients.push(...driverIds.map(String));
    }

    recipients = Array.from(new Set(recipients.filter(Boolean)));
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "Specify at least one recipient" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // Deduplicate & ensure not self-target
    recipients = recipients.filter((rid) => rid !== caller.id);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // Enforce recipient role constraints dynamically
    const { data: recRoles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', recipients);
    const roleMap = new Map<string, string[]>();
    (recRoles || []).forEach(r => {
      const arr = roleMap.get(r.user_id as string) || [];
      arr.push(r.role as string);
      roleMap.set(r.user_id as string, arr);
    });

    const driverAllowedRoles = ['admin', 'hr', 'finance'];
    const sanitizedRecipients = recipients.filter((rid) => {
      const roles = roleMap.get(rid) || [];
      if (roles.length === 0) return false;

      // Inactive users can only message admin
      if (isInactive) {
        return roles.includes('admin');
      }

      if (isOnboarding) {
        return roles.includes('admin');
      }

      if (isDriverOnly) {
        if (roles.includes('driver') || roles.includes('onboarding') || roles.includes('inactive')) {
          return false;
        }
        if (requestedRole) {
          return driverAllowedRoles.includes(requestedRole) && roles.includes(requestedRole);
        }
        return roles.some((role) => driverAllowedRoles.includes(role));
      }

      if (requestedRole) {
        return roles.includes(requestedRole);
      }

      return true;
    });

    if (sanitizedRecipients.length === 0) {
      let errorMsg = "No valid recipients. ";
      if (isInactive) {
        errorMsg += "Inactive users can only message admins.";
      } else if (isOnboarding) {
        errorMsg += "Onboarding users can only message admins.";
      } else if (isDriverOnly) {
        errorMsg += "Drivers cannot message other drivers or onboarding users. They can only message admin, HR, or finance staff.";
      } else if (requestedRole) {
        errorMsg += `No users found with role '${requestedRole}' that match the recipient criteria.`;
      } else {
        errorMsg += "All recipients were filtered out due to role restrictions.";
      }
      return new Response(JSON.stringify({ error: errorMsg }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // Log how many recipients were filtered out (for debugging)
    if (sanitizedRecipients.length < recipients.length) {
      console.log(`Filtered ${recipients.length - sanitizedRecipients.length} recipients due to role restrictions`);
    }

    // Insert notifications
    const rows = sanitizedRecipients.map(rid => ({ sender_id: caller.id, recipient_id: rid, title, body: content, kind }));
    const { error: insErr } = await supabase.from('notifications').insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, count: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    console.error('send-notification error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
