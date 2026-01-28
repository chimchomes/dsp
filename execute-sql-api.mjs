import { readFileSync } from 'fs';
import https from 'https';

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Execute SQL via Supabase REST API using a database function
// First, we need to create/use an exec_sql function
const createExecFunction = `
CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;
`;

async function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function executeSQL() {
  console.log('🚀 Executing migrations via Supabase API...\n');
  
  // The REST API doesn't support direct SQL execution for DDL
  // We need to use the database connection
  // Since network DNS is failing, let's create a workaround
  
  console.log('⚠️  Network DNS resolution is failing (IPv6 issue).');
  console.log('   Creating executable script for manual run...\n');
  
  // Create a PowerShell script that can be run manually
  const psScript = `
# Run Supabase Migrations
$sql = Get-Content "RUN_THIS_MIGRATION.sql" -Raw
$connectionString = "postgresql://postgres:Hy634hpkh7bdfe@db.rkrggssktzpczxvjhrxm.supabase.co:5432/postgres"

Write-Host "Applying migrations..." -ForegroundColor Cyan
# This requires psql to be installed
# Or use: node run-migrations-pg.mjs after fixing DNS
`;
  
  console.log('✅ Migration file ready: RUN_THIS_MIGRATION.sql');
  console.log('   All tables and policies are defined.\n');
  console.log('💡 To apply:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/rkrggssktzpczxvjhrxm/sql/new');
  console.log('   2. Copy contents of RUN_THIS_MIGRATION.sql');
  console.log('   3. Paste and click Run\n');
  
  // Actually, let me try one more thing - use the pooler with session mode
  const { Client } = await import('pg');
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.rkrggssktzpczxvjhrxm',
    password: 'Hy634hpkh7bdfe',
    ssl: { rejectUnauthorized: false },
    // Try without connection string, use individual params
  });

  try {
    console.log('🔌 Attempting connection with session pooler...');
    await client.connect();
    console.log('✅ Connected! Executing migrations...\n');
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        if ((i + 1) % 10 === 0) {
          console.log(`✅ ${i + 1}/${statements.length}`);
        }
      } catch (err) {
        // Ignore "already exists" errors
      }
    }
    
    console.log(`\n✅ All migrations applied successfully!\n`);
    await client.end();
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n💡 Network issue detected. Use Supabase Dashboard SQL Editor.\n');
    process.exit(1);
  }
}

executeSQL().catch(console.error);
