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
    
    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasPermission = roles?.some(r => r.role === 'admin' || r.role === 'hr');
    if (!hasPermission) {
      throw new Error('Only admins and HR can create driver accounts');
    }

    // Parse request body with all fields
    const { 
      firstName, 
      surname, 
      email, 
      password,
      contactPhone, 
      licenseNumber, 
      addressLine1,
      addressLine2,
      addressLine3,
      postcode,
      emergencyContactName, 
      emergencyContactPhone, 
      operatorId,
      nationalInsurance
    } = await req.json();

    // Validate required fields
    if (!firstName || !surname || !email || !password) {
      throw new Error('First name, surname, email, and password are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const fullName = `${firstName} ${surname}`.trim();

    // Create the user account with the provided password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: fullName,
        first_name: firstName,
        surname: surname,
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

    // Create profile record with personal information
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: newUser.user.id,
        email,
        first_name: firstName,
        surname: surname,
        full_name: fullName,
        contact_phone: contactPhone || null,
        address_line_1: addressLine1 || null,
        address_line_2: addressLine2 || null,
        address_line_3: addressLine3 || null,
        postcode: postcode || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Don't fail - profile might be created by trigger
    }

    // Create driver record with all information
    const { error: driverError } = await supabaseAdmin
      .from('drivers')
      .insert({
        user_id: newUser.user.id,
        email,
        name: fullName,
        first_name: firstName,
        surname: surname,
        contact_phone: contactPhone || null,
        address_line_1: addressLine1 || null,
        address_line_2: addressLine2 || null,
        address_line_3: addressLine3 || null,
        postcode: postcode || null,
        license_number: licenseNumber || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        operator_id: operatorId || null,
        national_insurance: nationalInsurance || null,
        onboarded_by: user.id,
        onboarded_at: new Date().toISOString(),
        active: true
      });

    if (driverError) {
      throw new Error(`Failed to create driver record: ${driverError.message}`);
    }

    // Log the activity
    try {
      await supabaseAdmin.rpc('log_activity', {
        p_action_type: 'driver_created',
        p_resource_type: 'driver',
        p_resource_id: newUser.user.id,
        p_action_details: { name: fullName, email }
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
      // Don't fail if logging fails
    }

    console.log(`Driver account created for ${email} by ${user.email}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user.id,
        email,
        message: 'Driver account created successfully. The driver must change their password on first login.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Create driver account error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
