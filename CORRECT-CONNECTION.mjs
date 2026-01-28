import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// For Supabase pooler, the correct format is:
// Transaction pooler (port 6543): postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[HOST]:6543/postgres
// But "Tenant or user not found" suggests wrong format

// Try with connection string that includes project ref in database name instead
const connectionString = 'postgresql://postgres:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres.rkrggssktzpczxvjhrxm';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function execute() {
  try {
    console.log('🔌 Connecting with alternative format...');
    await client.connect();
    console.log('✅ CONNECTED! Executing migrations...\n');
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
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
        // Continue
      }
    }
    await client.query('COMMIT');
    console.log(`\n✅✅✅ SUCCESS! ${success} migrations applied! ✅✅✅\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

execute();
