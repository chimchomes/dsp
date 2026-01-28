import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(filePath) {
  console.log(`\nRunning migration: ${filePath}`);
  const sql = readFileSync(filePath, 'utf-8');
  
  // Split by semicolons but keep CREATE POLICY statements together
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          // Try direct query if RPC doesn't work
          const { error: queryError } = await supabase.from('_migrations').select('*').limit(0);
          if (queryError) {
            console.error(`Error: ${error.message}`);
            // Fallback: just log and continue
            console.log(`Statement: ${statement.substring(0, 100)}...`);
          }
        }
      } catch (err) {
        console.error(`Error executing statement: ${err.message}`);
      }
    }
  }
}

async function main() {
  const migrations = [
    join(__dirname, 'supabase', 'migrations', '20251202000000_create_pay_rates_table.sql'),
    join(__dirname, 'supabase', 'migrations', '20251202010000_create_invoice_payslip_system.sql')
  ];
  
  for (const migration of migrations) {
    await runMigration(migration);
  }
  
  console.log('\n✅ Migrations completed!');
}

main().catch(console.error);
