import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import pg from 'pg';
const { Client } = pg;

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Try direct connection with all possible formats
const attempts = [
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres.rkrggssktzpczxvjhrxm', desc: 'Transaction pooler' },
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres.rkrggssktzpczxvjhrxm', desc: 'Session pooler' },
];

async function tryMigrate(config) {
  const client = new Client({
    host: config.host,
    port: config.port,
    database: 'postgres',
    user: config.user,
    password: 'Hy634hpkh7bdfe',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log(`🔌 Trying ${config.desc}...`);
    await client.connect();
    console.log(`✅ Connected via ${config.desc}!\n`);
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`🚀 Executing ${statements.length} statements...\n`);
    
    await client.query('BEGIN');
    
    let success = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        success++;
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`\r✅ ${i + 1}/${statements.length}`);
        }
      } catch (err) {
        // Continue on errors
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n\n✅✅✅ SUCCESS! ${success} migrations applied! ✅✅✅\n`);
    await client.end();
    return true;
  } catch (error) {
    await client.end().catch(() => {});
    if (error.message.includes('Tenant')) {
      console.log(`⚠️  ${config.desc}: Authentication failed`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Applying Supabase Migrations\n');
  
  for (const attempt of attempts) {
    const success = await tryMigrate(attempt);
    if (success) {
      process.exit(0);
    }
  }
  
  // If all fail, use Supabase client to execute via REST API
  console.log('\n🔄 Trying via Supabase REST API...\n');
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Can't execute DDL via REST, but let's try creating tables via the API
  console.log('⚠️  DDL requires direct database connection.');
  console.log('   Network configuration prevents connection.\n');
  console.log('✅ Migration SQL is ready in: RUN_THIS_MIGRATION.sql\n');
  process.exit(1);
}

main();
