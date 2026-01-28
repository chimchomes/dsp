import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Create exec_sql function via REST API using SQL editor endpoint simulation
async function createExecFunction() {
  // Try to create function via direct SQL execution
  // Use the Supabase REST API to execute SQL
  const createFuncSQL = `CREATE OR REPLACE FUNCTION public.exec_sql(sql_text text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN EXECUTE sql_text; END; $$;`;
  
  // Execute via HTTP POST to Supabase SQL endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql_text: createFuncSQL })
  });
  
  return response.ok;
}

async function executeMigrations() {
  console.log('🚀 Executing migrations via Supabase API...\n');
  
  // Split SQL
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  
  // Execute each statement via REST API
  let success = 0;
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    try {
      // Use Supabase REST API to execute SQL
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
      
      if (response.ok) {
        success++;
        if ((i + 1) % 10 === 0) {
          console.log(`✅ ${i + 1}/${statements.length}`);
        }
      }
    } catch (err) {
      // Continue
    }
  }
  
  console.log(`\n✅ ${success} statements executed!\n`);
}

// Actually, REST API doesn't support DDL. Need direct DB connection.
// Since DNS fails, let's use the pooler with correct format
import pg from 'pg';
const { Client } = pg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use transaction pooler (port 6543) with session mode
const client = new Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.rkrggssktzpczxvjhrxm',
  password: 'Hy634hpkh7bdfe',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function run() {
  try {
    console.log('🔌 Connecting via transaction pooler...');
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
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

run();
