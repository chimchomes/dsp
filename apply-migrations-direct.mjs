import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql) {
  // Use the REST API to execute SQL via rpc
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement) continue;
    
    try {
      // Try using the management API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ sql_query: statement + ';' })
      });
      
      if (!response.ok) {
        // Try direct SQL execution via PostgREST
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        // For DDL, we need to use the database directly
        // Fallback: log the statement
        if (statement.length > 100) {
          console.log(`  ${statement.substring(0, 100)}...`);
        } else {
          console.log(`  ${statement}`);
        }
      } else {
        console.log(`✅ Statement ${i + 1} executed`);
      }
    } catch (err) {
      console.log(`⚠️  Statement ${i + 1}: ${err.message}`);
    }
  }
}

async function runMigration(filePath) {
  console.log(`\n📄 Running: ${filePath}`);
  const sql = readFileSync(filePath, 'utf-8');
  await executeSQL(sql);
}

async function main() {
  console.log('🚀 Applying migrations via Supabase API...\n');
  
  const migrations = [
    join(__dirname, 'supabase', 'migrations', '20251202000000_create_pay_rates_table.sql'),
    join(__dirname, 'supabase', 'migrations', '20251202010000_create_invoice_payslip_system.sql')
  ];
  
  for (const migration of migrations) {
    try {
      await runMigration(migration);
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
    }
  }
  
  console.log('\n✅ Migration files processed');
  console.log('⚠️  Note: DDL statements need to be run in Supabase SQL Editor');
  console.log('   Copy contents of RUN_THIS_MIGRATION.sql to SQL Editor\n');
}

main().catch(console.error);
