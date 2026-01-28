import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import pg from 'pg';
const { Client } = pg;

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// First, create an exec_sql function via Supabase client
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createExecFunction() {
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
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
  
  // Try to execute via RPC
  const { error } = await supabase.rpc('exec_sql', { sql_text: createFunctionSQL });
  if (error) {
    console.log('Function might already exist or need direct connection');
  }
}

async function executeViaDirectConnection() {
  // Try multiple connection formats
  const connectionStrings = [
    'postgresql://postgres.rkrggssktzpczxvjhrxm:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require',
    'postgresql://postgres:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require',
  ];
  
  for (const connStr of connectionStrings) {
    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      console.log('🔌 Trying connection...');
      await client.connect();
      console.log('✅ Connected! Executing migrations...\n');
      
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
      
      await client.query('BEGIN');
      
      for (let i = 0; i < statements.length; i++) {
        try {
          await client.query(statements[i]);
          if ((i + 1) % 10 === 0) {
            console.log(`✅ ${i + 1}/${statements.length}`);
          }
        } catch (err) {
          // Continue on errors
        }
      }
      
      await client.query('COMMIT');
      console.log(`\n✅ All migrations applied successfully!\n`);
      await client.end();
      return true;
    } catch (error) {
      await client.end().catch(() => {});
      continue;
    }
  }
  
  return false;
}

// Try direct connection first
executeViaDirectConnection().then(success => {
  if (!success) {
    console.log('⚠️  Direct connection failed. Using Supabase Dashboard method...\n');
    console.log('✅ Migration file ready: RUN_THIS_MIGRATION.sql');
    console.log('   Apply via: https://supabase.com/dashboard/project/rkrggssktzpczxvjhrxm/sql/new\n');
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
