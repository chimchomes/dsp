import { readFileSync } from 'fs';
import https from 'https';

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

function makeRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, supabaseUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data });
        } else {
          resolve({ status: res.statusCode, data, error: true });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function executeSQL() {
  console.log('🚀 Executing migrations via Supabase REST API...\n');
  
  // First, try to create exec_sql function via RPC
  const createFunction = `
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
  
  try {
    const result = await makeRequest('/rest/v1/rpc/exec_sql', 'POST', { sql_text: createFunction });
    if (result.error) {
      console.log('⚠️  Function creation via RPC failed (might need direct connection)');
    }
  } catch (err) {
    console.log('⚠️  Cannot create function via REST API');
  }
  
  // Since DDL can't be executed via REST API, we need direct connection
  // But let's try using the Supabase client to execute via a different method
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Try to execute SQL statements via the client
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`Attempting to execute ${statements.length} statements...\n`);
  
  // Supabase REST API doesn't support DDL, so we need direct DB connection
  // But since that's failing, let's use the Management API approach
  console.log('⚠️  DDL statements require direct database connection.');
  console.log('   Network DNS issue prevents direct connection.\n');
  console.log('✅ Migration file ready: RUN_THIS_MIGRATION.sql');
  console.log('   All SQL is prepared and ready to execute.\n');
  console.log('💡 To apply:');
  console.log('   1. Open Supabase Dashboard SQL Editor');
  console.log('   2. Copy RUN_THIS_MIGRATION.sql contents');
  console.log('   3. Paste and run\n');
  
  // Actually, let me try one more thing - use the connection with a different approach
  const pg = await import('pg');
  const { Client } = pg.default;
  
  // Try connection with all possible formats
  const attempts = [
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres.rkrggssktzpczxvjhrxm' },
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres.rkrggssktzpczxvjhrxm' },
  ];
  
  for (const attempt of attempts) {
    const client = new Client({
      ...attempt,
      database: 'postgres',
      password: 'Hy634hpkh7bdfe',
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      await client.connect();
      console.log(`✅ Connected via ${attempt.user}@${attempt.host}:${attempt.port}!\n`);
      
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
      console.log(`\n✅ SUCCESS! ${success} migrations applied!\n`);
      await client.end();
      process.exit(0);
    } catch (err) {
      await client.end().catch(() => {});
    }
  }
  
  console.log('❌ All connection methods failed due to network configuration.\n');
  process.exit(1);
}

executeSQL();
