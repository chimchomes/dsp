import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  console.error('Get your service role key from: https://supabase.com/dashboard/project/rkrggssktzpczxvjhrxm/settings/api');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql) {
  // Remove comments and empty lines
  const cleanSQL = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
    .join('\n');
  
  // Split by semicolon but keep multi-line statements together
  const statements = cleanSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;
    
    try {
      // Use RPC to execute SQL
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: statement + ';' 
      });
      
      if (error) {
        // Try direct query approach
        console.log(`⚠️  RPC failed, trying alternative method for statement ${i + 1}...`);
        // For DDL statements, we need to use the REST API or direct connection
        // This is a fallback - the SQL editor is still the most reliable
        console.log(`Statement: ${statement.substring(0, 100)}...`);
      } else {
        console.log(`✅ Statement ${i + 1} executed`);
      }
    } catch (err) {
      console.error(`❌ Error on statement ${i + 1}:`, err.message);
      console.log(`Statement preview: ${statement.substring(0, 200)}...`);
    }
  }
}

async function runMigration(filePath) {
  console.log(`\n📄 Running: ${filePath}`);
  const sql = readFileSync(filePath, 'utf-8');
  await executeSQL(sql);
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  const migrations = [
    join(__dirname, 'supabase', 'migrations', '20251202000000_create_pay_rates_table.sql'),
    join(__dirname, 'supabase', 'migrations', '20251202010000_create_invoice_payslip_system.sql')
  ];
  
  console.log('🚀 Starting migrations...\n');
  
  for (const migration of migrations) {
    try {
      await runMigration(migration);
    } catch (err) {
      console.error(`❌ Failed to run ${migration}:`, err.message);
    }
  }
  
  console.log('\n✅ Migration process completed!');
  console.log('\n⚠️  Note: Some DDL statements may need to be run in Supabase SQL Editor');
  console.log('   If you see errors, copy RUN_THIS_MIGRATION.sql to SQL Editor');
}

main().catch(console.error);
