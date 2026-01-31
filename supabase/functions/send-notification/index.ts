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
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    if (!authHeader) {
      console.error('Missing authorization header. Headers:', Object.fromEntries(req.headers.entries()));
      return new Response(JSON.stringify({ error: "Missing authorization header" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '').replace('bearer ', '');
    if (!token) {
      console.error('No token found in authorization header');
      return new Response(JSON.stringify({ error: "Invalid authorization header format" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      console.error('Auth error:', userErr);
      return new Response(JSON.stringify({ error: "Unauthorized", details: userErr?.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }

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
    const isRouteAdmin = hasRole('route-admin') || hasRole('dispatcher');
    const isAdmin = hasRole('admin');
    const isFinance = hasRole('finance');
    const isHR = hasRole('hr');
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
      return new Response(JSON.stringify({ error: "No recipients (all recipients are yourself)" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // Enforce recipient role constraints dynamically
    const { data: recRoles, error: recRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', recipients);
    
    if (recRolesError) {
      console.error('Error fetching recipient roles:', recRolesError);
      return new Response(JSON.stringify({ error: "Failed to validate recipients", details: recRolesError.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
    }
    
    const roleMap = new Map<string, string[]>();
    (recRoles || []).forEach(r => {
      const arr = roleMap.get(r.user_id as string) || [];
      arr.push(r.role as string);
      roleMap.set(r.user_id as string, arr);
    });
    
    // Log for debugging
    console.log(`=== MESSAGE SEND ATTEMPT ===`);
    console.log(`Caller ID: ${caller.id}`);
    console.log(`Caller Roles: ${callerRoles.join(', ')}`);
    console.log(`isRouteAdmin: ${isRouteAdmin}, isAdmin: ${isAdmin}`);
    console.log(`Requested role: ${requestedRole || 'none'}`);
    console.log(`Recipients provided: ${recipients.length} - [${recipients.join(', ')}]`);
    console.log(`Found roles for ${roleMap.size} out of ${recipients.length} recipients`);
    
    // Log each recipient's roles
    recipients.forEach(rid => {
      const roles = roleMap.get(rid) || [];
      if (roles.length === 0) {
        console.log(`  ❌ Recipient ${rid}: NO ROLES ASSIGNED`);
      } else {
        console.log(`  ✓ Recipient ${rid}: roles = [${roles.join(', ')}]`);
      }
    });

    const driverAllowedRoles = ['admin', 'hr', 'finance'];
    const sanitizedRecipients = recipients.filter((rid) => {
      const roles = roleMap.get(rid) || [];
      
      // Rule 7: No one can message themselves (already filtered above, but double-check)
      if (rid === caller.id) {
        console.log(`Recipient ${rid} is self - filtering out`);
        return false;
      }

      // Rule 3: Admin can message all (including users with no roles)
      if (isAdmin) {
        console.log(`Admin: Allowing recipient ${rid} with roles: [${roles.join(', ') || 'none'}]`);
        return true; // Admin can message everyone, even if they have no roles
      }

      // If recipient has no roles, they can't receive messages (must have a role)
      // Exception: Admin can message users with no roles (handled above)
      if (roles.length === 0) {
        console.log(`Recipient ${rid} has no roles assigned - filtering out`);
        return false;
      }

      // Rule 1: Route-admin and Inactive cannot message anyone (removed from messaging)
      if ((isRouteAdmin && !isAdmin) || isInactive) {
        console.log(`Route-admin/Inactive: User ${caller.id} is not allowed to message anyone`);
        return false;
      }

      // Rule 2: Onboarding can only message admin
      if (isOnboarding) {
        return roles.includes('admin');
      }

      // Rule 4: Driver can message hr, finance, admin
      if (isDriverOnly) {
        if (requestedRole) {
          return driverAllowedRoles.includes(requestedRole) && roles.includes(requestedRole);
        }
        return roles.some((role) => driverAllowedRoles.includes(role));
      }

      // Rule 5: Finance can message driver, admin, hr
      if (isFinance) {
        const financeAllowedRoles = ['driver', 'admin', 'hr'];
        if (requestedRole) {
          return financeAllowedRoles.includes(requestedRole) && roles.includes(requestedRole);
        }
        return roles.some((role) => financeAllowedRoles.includes(role));
      }

      // Rule 6: HR can message finance, admin, driver
      if (isHR) {
        const hrAllowedRoles = ['finance', 'admin', 'driver'];
        if (requestedRole) {
          return hrAllowedRoles.includes(requestedRole) && roles.includes(requestedRole);
        }
        return roles.some((role) => hrAllowedRoles.includes(role));
      }

      // Default: allow if requested role matches
      if (requestedRole) {
        return roles.includes(requestedRole);
      }

      return true;
    });

    if (sanitizedRecipients.length === 0) {
      // Check why recipients were filtered out
      const recipientsWithNoRoles = recipients.filter(rid => (roleMap.get(rid) || []).length === 0);
      
      let errorMsg = "No valid recipients. ";
      
      if (recipientsWithNoRoles.length > 0) {
        errorMsg += `${recipientsWithNoRoles.length} recipient(s) have no roles assigned. `;
      }
      
      if (isAdmin) {
        errorMsg += `Admin should be able to message all roles. `;
        if (recipientsWithNoRoles.length > 0) {
          errorMsg += `However, ${recipientsWithNoRoles.length} recipient(s) have no roles assigned. Users must have at least one role to receive messages.`;
        } else {
          errorMsg += `All ${recipients.length} recipient(s) were filtered out. This should not happen for admin.`;
        }
      } else if (isInactive) {
        errorMsg += "Inactive users cannot send messages.";
      } else if (isOnboarding) {
        errorMsg += "Onboarding users can only message admins.";
      } else if (isRouteAdmin && !isAdmin) {
        errorMsg += "Route-admins cannot send messages.";
      } else if (isDriverOnly) {
        errorMsg += "Drivers can only message admin, HR, or finance staff.";
      } else if (isFinance) {
        errorMsg += "Finance staff can only message drivers, admin, or HR staff.";
      } else if (isHR) {
        errorMsg += "HR staff can only message finance, admin, or drivers.";
      } else if (requestedRole) {
        errorMsg += `No users found with role '${requestedRole}' that match the recipient criteria.`;
      } else {
        errorMsg += "All recipients were filtered out due to role restrictions.";
      }
      
      console.error(`❌ ERROR: ${errorMsg}`);
      console.error(`Recipients provided: ${recipients.join(', ')}`);
      console.error(`Valid recipients: ${sanitizedRecipients.length}`);
      console.error(`Recipients with no roles: ${recipientsWithNoRoles.join(', ') || 'none'}`);
      console.error(`Recipients with onboarding: ${recipientsWithOnboarding.join(', ') || 'none'}`);
      
      return new Response(JSON.stringify({ 
        error: errorMsg,
        debug: {
          callerRoles: callerRoles,
          isRouteAdmin,
          isAdmin,
          recipientsProvided: recipients.length,
          recipientsWithRoles: roleMap.size,
          recipientsWithNoRoles: recipientsWithNoRoles.length,
          recipientsWithOnboarding: recipientsWithOnboarding.length
        }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }

    // Log how many recipients were filtered out (for debugging)
    if (sanitizedRecipients.length < recipients.length) {
      console.log(`Filtered ${recipients.length - sanitizedRecipients.length} recipients due to role restrictions`);
      console.log(`Original recipients: ${recipients.length}, Valid recipients: ${sanitizedRecipients.length}`);
    }

    // Insert notifications
    const rows = sanitizedRecipients.map(rid => ({ sender_id: caller.id, recipient_id: rid, title, body: content, kind }));
    console.log(`Inserting ${rows.length} notification(s) for recipients: ${sanitizedRecipients.join(', ')}`);
    const { error: insErr } = await supabase.from('notifications').insert(rows);
    if (insErr) {
      console.error('Error inserting notifications:', insErr);
      throw insErr;
    }
    console.log(`✅ Successfully sent ${rows.length} notification(s)`);

    return new Response(JSON.stringify({ ok: true, count: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    console.error('send-notification error', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
