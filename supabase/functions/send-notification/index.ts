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

    // Determine role
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);
    const isAdmin = !!roleRows?.some(r => r.role === 'admin');
    const isDriver = !!roleRows?.some(r => r.role === 'driver');
    const isFinance = !!roleRows?.some(r => r.role === 'finance');
    const isHR = !!roleRows?.some(r => r.role === 'hr');
    const isOnboarding = !!roleRows?.some(r => r.role === 'onboarding');

    let recipients: string[] = [];

    if (isAdmin) {
      // Admin -> any role, but a specific recipient is required (no broadcast without explicit selection)
      if (Array.isArray(recipientIds) && recipientIds.length > 0) {
        recipients = recipientIds.map(String);
      } else if (recipientId) {
        recipients = [String(recipientId)];
      } else if (Array.isArray(driverIds) && driverIds.length > 0) {
        recipients = driverIds.map(String);
      } else {
        return new Response(JSON.stringify({ error: 'Specify recipientId or recipientIds' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    } else if (isFinance || isHR) {
      // Finance/HR -> driver(s) or admin, specific recipients only
      if (Array.isArray(recipientIds) && recipientIds.length > 0) {
        recipients = recipientIds.map(String);
      } else if (recipientId) {
        recipients = [String(recipientId)];
      } else {
        return new Response(JSON.stringify({ error: 'Specify recipientId or recipientIds' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    } else if (isDriver) {
      // Driver -> admins | hr | finance, must pick a specific recipient
      const targetRole = recipientRole && ['admin','hr','finance'].includes(String(recipientRole)) ? String(recipientRole) : 'admin';
      if (recipientId) {
        recipients = [String(recipientId)];
      } else if (Array.isArray(recipientIds) && recipientIds.length > 0) {
        recipients = recipientIds.map(String);
      } else {
        return new Response(JSON.stringify({ error: 'Specify recipientId or recipientIds' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    } else if (isOnboarding) {
      // Onboarding applicants -> admin only, but only if they have a session (started form)
      const { data: sess } = await supabase.from('onboarding_sessions').select('id').eq('user_id', caller.id).limit(1);
      if (!sess || sess.length === 0) return new Response(JSON.stringify({ error: 'You need to start your application before messaging admin' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
      if (recipientId) {
        recipients = [String(recipientId)];
      } else {
        return new Response(JSON.stringify({ error: 'Specify recipientId (admin)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    } else {
      return new Response(JSON.stringify({ error: "Role not permitted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 });
    }

    // Deduplicate & ensure not self-target
    recipients = Array.from(new Set(recipients.filter(Boolean))).filter((rid) => rid !== caller.id);
    if (recipients.length === 0) return new Response(JSON.stringify({ error: "No recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });

    // Enforce recipient role constraints
    const { data: recRoles } = await supabase.from('user_roles').select('user_id, role').in('user_id', recipients);
    const roleMap = new Map<string, string[]>();
    (recRoles || []).forEach(r => {
      const arr = roleMap.get(r.user_id as string) || [];
      arr.push(r.role as string);
      roleMap.set(r.user_id as string, arr);
    });
    const allowFor = (allowed: string[]) => recipients.filter(rid => (roleMap.get(rid) || []).some(r => allowed.includes(r)));
    if (isDriver) {
      recipients = allowFor(['admin','hr','finance']);
    } else if (isFinance || isHR) {
      recipients = allowFor(['driver','admin']);
    } else if (isOnboarding) {
      recipients = allowFor(['admin']);
    } // admin can message anyone
    if (recipients.length === 0) return new Response(JSON.stringify({ error: "No recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });

    // Insert notifications
    const rows = recipients.map(rid => ({ sender_id: caller.id, recipient_id: rid, title, body: content, kind }));
    const { error: insErr } = await supabase.from('notifications').insert(rows);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, count: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    console.error('send-notification error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
