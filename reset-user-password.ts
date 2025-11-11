import { createClient } from "@supabase/supabase-js";

// ---------------- CONFIG ----------------
const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const TARGET_EMAIL = "jezza@hotmail.com";
const NEW_PASSWORD = "Karib!23";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function resetPassword() {
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

  console.log(
    `✅ Password for ${TARGET_EMAIL} has been reset to '${NEW_PASSWORD}'`
  );
}

resetPassword()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Script failed:", err);
    process.exit(1);
  });

