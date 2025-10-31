// recreateUsers.mjs

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// !!! ⚠️ 1. HARDCODED CONFIGURATION: PASTE YOUR KEYS HERE ⚠️ !!!
// NOTE: These variables are copied from your .env.local file to bypass the loading issue.
// DELETE THESE VALUES (and the file) immediately after running the script once.
// =============================================================================
const supabaseUrl = ""; 
const supabaseServiceRoleKey = "";
// =============================================================================

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase URL or Service Role Key in script configuration.");
    console.error("Please ensure the hardcoded values above are correctly copied.");
    process.exit(1);
}

// Initialize Supabase Client with Service Role Key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // This setting allows using the Service Role Key for Admin operations
    autoRefreshToken: false,
    persistSession: false,
  },
});

// User data provided by you (The UUIDs are essential)
const usersToRecreate = [
    {
        id: "9907609a-ecb8-467b-8748-02fcceb90615",
        email: "dispatcher1@test.com",
        // NOTE: A temporary password must be set. The user must use 'Forgot Password' to set a new one.
        password: "temporarypassword123", 
        email_confirm: true,
    },
    {
        id: "3b8edf56-6800-4735-b23a-f55f0e1d14d2",
        email: "finance@hotmail.com",
        password: "temporarypassword123",
        email_confirm: true,
    },
    {
        id: "581eb2da-c399-49d6-9d81-8ff272df8011",
        email: "jezza@hotmail.com",
        password: "temporarypassword123",
        email_confirm: true,
    },
    {
        id: "f74447fb-323f-417e-bb27-6cf14cf49c88",
        email: "admin@test.com",
        password: "temporarypassword123",
        email_confirm: true,
    },
];

async function recreateUsers() {
    console.log(`Attempting to recreate ${usersToRecreate.length} users in project ${supabaseUrl}...`);
    
    for (const user of usersToRecreate) {
        try {
            // Use the admin.createUser() method to insert a user with a specific UUID
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: user.email_confirm,
                // Pass the original UUID
                id: user.id, 
            });

            if (error) {
                if (error.message.includes('duplicate key value')) {
                    console.warn(`WARN: User ${user.email} (ID: ${user.id}) already exists. Skipping.`);
                    continue;
                }
                throw error;
            }

            console.log(`SUCCESS: User created: ${data.user.email} (ID: ${data.user.id})`);

        } catch (error) {
            console.error(`FAILURE: Could not create user ${user.email}. Error:`, error.message);
        }
    }
    console.log("\n--- USER RECREATION PROCESS FINISHED ---");
    
    // Crucial step: The passwords used were temporary.
    console.log("!!! ⚠️ SECURITY ACTION REQUIRED IMMEDIATELY ⚠️ !!!");
    console.log("1. **DELETE** the Service Role Key and URL from this script file (`recreateUsers.mjs`).");
    console.log("2. **RERUN** your remaining data scripts to fix foreign key constraints.");
    console.log("3. Inform users to use the 'Forgot Password' link to set a new, secure password.");
}

recreateUsers();