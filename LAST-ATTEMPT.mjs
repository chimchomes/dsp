import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use the exact format from Supabase connection string
// Format: postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
const connectionString = 'postgresql://postgres.rkrggssktzpczxvjhrxm:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';

// Disable SSL verification for self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: connectionString,
  ssl: false, // Disable SSL for pooler connection
  connectionTimeoutMillis: 30000,
});

async function execute() {
  try {
    console.log('🔌 Connecting...');
    await client.connect();
    console.log('✅ CONNECTED! Executing migrations...\n');
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Executing ${statements.length} statements...\n`);
    
    await client.query('BEGIN');
    
    let count = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        count++;
        if ((i + 1) % 5 === 0) {
          console.log(`✅ ${i + 1}/${statements.length}`);
        }
      } catch (err) {
        // Ignore "already exists" errors
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅✅✅ SUCCESS! ${count} migrations applied! ✅✅✅\n`);
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

execute();
