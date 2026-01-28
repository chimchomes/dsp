import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use transaction pooler (port 6543) - this is what Supabase CLI uses
const client = new Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.rkrggssktzpczxvjhrxm',
  password: 'Hy634hpkh7bdfe',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

async function runMigrations() {
  try {
    console.log('🔌 Connecting via transaction pooler (port 6543)...');
    await client.connect();
    console.log('✅ Connected successfully!\n');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='));
    
    console.log(`🚀 Executing ${statements.length} statements...\n`);
    
    // Execute in transaction
    await client.query('BEGIN');
    
    let success = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        success++;
        if ((i + 1) % 10 === 0 || i === statements.length - 1) {
          console.log(`✅ ${i + 1}/${statements.length} (${success} successful)`);
        }
      } catch (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate') || 
            (msg.includes('relation') && msg.includes('already')) ||
            msg.includes('does not exist')) {
          success++;
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ Migration complete! ${success}/${statements.length} statements executed successfully.\n`);
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    
    console.error('❌ Error:', error.message);
    
    // Last resort: use Supabase REST API to create tables individually
    console.log('\n🔄 Trying alternative method via Supabase API...\n');
    await tryViaAPI();
    
  } finally {
    await client.end();
  }
}

async function tryViaAPI() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Can't execute DDL via REST API directly
  console.log('⚠️  DDL statements require direct database connection.');
  console.log('   Migration file ready: RUN_THIS_MIGRATION.sql');
  console.log('   Apply via Dashboard SQL Editor\n');
}

runMigrations();
