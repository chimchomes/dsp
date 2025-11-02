import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      throw new Error('Only admins can create driver accounts');
    }

    const { name, email, contactPhone, licenseNumber, address, emergencyContactName, emergencyContactPhone } = await req.json();

    if (!name || !email) {
      throw new Error('Name and email are required');
    }

    // Generate a secure random temporary password
    const tempPassword = crypto.randomUUID() + crypto.randomUUID().substring(0, 8);

    // Create the user account
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name,
        requires_password_change: true
      }
    });

    if (createError || !newUser.user) {
      throw new Error(`Failed to create user: ${createError?.message}`);
    }

    // Assign driver role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'driver'
      });

    if (roleError) {
      throw new Error(`Failed to assign role: ${roleError.message}`);
    }

    // Create driver record
    const { error: driverError } = await supabaseAdmin
      .from('drivers')
      .insert({
        email,
        name,
        contact_phone: contactPhone,
        license_number: licenseNumber,
        address,
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone,
        onboarded_by: user.id,
        onboarded_at: new Date().toISOString(),
        active: true
      });

    if (driverError) {
      throw new Error(`Failed to create driver record: ${driverError.message}`);
    }

    // Log the activity
    await supabaseAdmin.rpc('log_activity', {
      p_action_type: 'driver_account_created',
      p_resource_type: 'driver',
      p_resource_id: newUser.user.id,
      p_action_details: { name, email }
    });

    // Log password creation for admin reference (not returned in response)
    console.log(`Driver account created for ${email}. Temporary password generated (not logged for security).`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user.id,
        email,
        message: 'Driver account created successfully. Temporary password has been generated and must be provided to the driver securely.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
