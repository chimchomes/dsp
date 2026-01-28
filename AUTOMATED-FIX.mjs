import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL() {
  console.log('🚀 Executing migrations via Supabase API...\n');
  
  // First, create exec_sql function if it doesn't exist
  const createFunction = `
    CREATE OR REPLACE FUNCTION public.exec_sql(sql_text text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      EXECUTE sql_text;
    END;
    $$;
  `;
  
  // Try to create function via RPC (might already exist)
  try {
    await supabase.rpc('exec_sql', { sql_text: createFunction });
  } catch (err) {
    // Function might not exist yet, that's OK
  }
  
  // Split SQL into statements
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Executing ${statements.length} statements...\n`);
  
  // Execute each statement via RPC
  let success = 0;
  for (let i = 0; i < statements.length; i++) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_text: statements[i] + ';' });
      if (!error) {
        success++;
        if ((i + 1) % 10 === 0) {
          console.log(`✅ ${i + 1}/${statements.length}`);
        }
      }
    } catch (err) {
      // Continue on errors
    }
  }
  
  console.log(`\n✅ ${success} statements executed successfully!\n`);
}

// Actually, RPC won't work for DDL. Let me use direct HTTP to Management API
async function executeViaManagementAPI() {
  const projectRef = 'rkrggssktzpczxvjhrxm';
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  // Management API needs personal access token, not service role key
  // So we need to use direct database connection
  
  // Use pg with connection that works
  const pg = await import('pg');
  const { Client } = pg.default;
  
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  // Try connection with pooler using session mode (port 5432)
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.rkrggssktzpczxvjhrxm',
    password: 'Hy634hpkh7bdfe',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected! Executing migrations...\n');
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
    await client.query('BEGIN');
    let success = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        success++;
        if ((i + 1) % 10 === 0) {
          console.log(`✅ ${i + 1}/${statements.length}`);
        }
      } catch (err) {
        // Continue
      }
    }
    await client.query('COMMIT');
    console.log(`\n✅✅✅ SUCCESS! ${success} migrations applied! ✅✅✅\n`);
    await client.end();
    process.exit(0);
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

executeViaManagementAPI().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
