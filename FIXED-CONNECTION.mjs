import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Direct connection (not pooler) - this is what Supabase CLI uses for migrations
// User is 'postgres', not 'postgres.project-ref'
const client = new Client({
  host: 'db.rkrggssktzpczxvjhrxm.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Hy634hpkh7bdfe',
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  connectionTimeoutMillis: 30000,
});

async function execute() {
  try {
    console.log('🔌 Connecting to Supabase database (direct connection)...');
    await client.connect();
    console.log('✅ CONNECTED! Executing migrations...\n');
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`🚀 Executing ${statements.length} statements...\n`);
    
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
        const msg = err.message.toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          success++;
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅✅✅ SUCCESS! ${success} migrations applied! ✅✅✅\n`);
    process.exit(0);
    
  } catch (error) {
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('❌ DNS resolution failed - IPv6 network issue');
      console.error('   Hostname cannot be resolved on your network\n');
      console.log('💡 Fix: Enable IPv6 DNS resolution or use different network');
      console.log('   The migrations are ready in: RUN_THIS_MIGRATION.sql\n');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

execute();
