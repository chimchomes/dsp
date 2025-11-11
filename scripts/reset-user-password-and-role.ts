import { createClient } from "@supabase/supabase-js";

// ---------------- CONFIG ----------------
const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const TARGET_EMAIL = "jezza@hotmail.com";
const NEW_PASSWORD = "Karib!23";
const ROLE_TO_ASSIGN = "hr";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function resetPasswordAndGiveRole() {
  console.log(`Looking for ${TARGET_EMAIL} in auth.users...`);

  // 1. Find the user in Supabase Auth by email
  const { data: listData, error: listErr } =
    await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw listErr;

  const targetUser = listData.users.find(
    (u: any) => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase()
  );

  if (!targetUser) {
    throw new Error(`User ${TARGET_EMAIL} not found in Supabase Auth`);
  }

  const userId = targetUser.id;
  console.log("Found user ID:", userId);

  // 2. Update password and confirm email
  console.log("Updating password & confirming email...");
  const { error: updateErr } =
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: NEW_PASSWORD,
      email_confirm: true,
    });

  if (updateErr) {
    throw new Error(
      `Failed to update user password: ${updateErr.message}`
    );
  }

  console.log("Password updated successfully");

  // 3. Assign role - Use INSERT with conflict handling
  // Since user_roles has UNIQUE (user_id, role), we need to handle conflicts
  console.log(`Assigning role '${ROLE_TO_ASSIGN}' in user_roles table...`);

  // Option A: Remove all existing roles first, then insert new one
  // (Use this if you want the user to have ONLY this role)
  const { error: deleteErr } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (deleteErr) {
    console.warn(`Warning: Failed to delete existing roles: ${deleteErr.message}`);
    // Continue anyway - we'll try to insert
  } else {
    console.log("Removed all existing roles for user");
  }

  // Insert the new role
  const { error: insertRoleErr } = await supabaseAdmin
    .from("user_roles")
    .insert({
      user_id: userId,
      role: ROLE_TO_ASSIGN,
    });

  if (insertRoleErr) {
    // Check if it's a conflict error (shouldn't happen after delete, but just in case)
    if (insertRoleErr.code === "23505") {
      console.log(`Role '${ROLE_TO_ASSIGN}' already exists for this user`);
    } else {
      throw new Error(
        `Failed to assign role: ${insertRoleErr.message}`
      );
    }
  } else {
    console.log(`Successfully assigned role '${ROLE_TO_ASSIGN}'`);
  }

  // Option B: If you want to ADD the role (keep existing roles), use this instead:
  // Just insert - if it fails with unique violation, the role already exists (which is fine)
  // const { error: insertRoleErr } = await supabaseAdmin
  //   .from("user_roles")
  //   .insert({
  //     user_id: userId,
  //     role: ROLE_TO_ASSIGN,
  //   });
  // if (insertRoleErr && insertRoleErr.code !== "23505") {
  //   throw new Error(`Failed to assign role: ${insertRoleErr.message}`);
  // }

  console.log(
    `✅ ${TARGET_EMAIL} now has password '${NEW_PASSWORD}' and role '${ROLE_TO_ASSIGN}'`
  );
}

resetPasswordAndGiveRole()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Script failed:", err);
    process.exit(1);
  });

