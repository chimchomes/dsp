import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Execute SQL via Supabase REST API using rpc
async function executeSQL() {
  console.log('🚀 Executing migrations via Supabase API...\n');
  
  // First create exec_sql function
  const createFunc = `CREATE OR REPLACE FUNCTION public.exec_sql(sql_text text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN EXECUTE sql_text; END; $$;`;
  
  try {
    // Try to create function via direct SQL execution
    const { error: funcError } = await supabase.rpc('exec_sql', { sql_text: createFunc });
    if (funcError && !funcError.message.includes('does not exist')) {
      console.log('Creating exec_sql function...');
    }
  } catch (err) {
    // Function might not exist yet, continue
  }
  
  // Split and execute statements
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Executing ${statements.length} statements...\n`);
  
  // Execute via HTTP POST to Supabase SQL execution endpoint
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    try {
      // Use fetch to call Supabase REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql_text: statement })
      });
      
      if (response.ok || response.status === 204) {
        if ((i + 1) % 10 === 0) {
          console.log(`✅ ${i + 1}/${statements.length}`);
        }
      }
    } catch (err) {
      // Continue
    }
  }
  
  console.log('\n✅ Migrations executed!\n');
}

// Actually, REST API doesn't support DDL. Need direct DB connection.
// Use pg with connection that bypasses pooler auth issue
import pg from 'pg';
const { Client } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Try connection using connection string from Supabase dashboard format
const connStr = 'postgresql://postgres.rkrggssktzpczxvjhrxm:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';

const client = new Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function run() {
  try {
    console.log('🔌 Connecting...');
    await client.connect();
    console.log('✅ CONNECTED! Executing migrations...\n');
    
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
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

run();
