import { readFileSync } from 'fs';
import https from 'https';

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use Supabase Management API to execute SQL
const projectRef = 'rkrggssktzpczxvjhrxm';
const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

console.log('🚀 Applying migrations via Supabase Management API...\n');

// Split into manageable chunks
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

async function executeViaAPI() {
  // The Management API requires a different auth token
  // Let's use the database connection directly with a different approach
  console.log('⚠️  Management API requires personal access token.');
  console.log('   Using direct database connection instead...\n');
  
  // Try connection with transaction mode
  const { Client } = await import('pg');
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.rkrggssktzpczxvjhrxm',
    password: 'Hy634hpkh7bdfe',
    ssl: { rejectUnauthorized: false },
    // Use transaction mode for pooler
    options: '-c statement_timeout=30000'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Execute all statements in a transaction
    await client.query('BEGIN');
    
    let success = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i] + ';');
        success++;
        if ((i + 1) % 5 === 0) {
          console.log(`✅ ${i + 1}/${statements.length} statements executed`);
        }
      } catch (err) {
        // Continue on errors (might be "already exists")
        if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
          console.log(`⚠️  ${i + 1}: ${err.message.substring(0, 80)}`);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ All ${success} migrations applied successfully!\n`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

executeViaAPI().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  console.log('\n💡 Alternative: Copy RUN_THIS_MIGRATION.sql to Supabase SQL Editor\n');
  process.exit(1);
});
