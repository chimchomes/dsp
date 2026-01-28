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
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000,
});

// Set Node to accept self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function execute() {
  try {
    console.log('🔌 Connecting to Supabase database...');
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
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

execute();
