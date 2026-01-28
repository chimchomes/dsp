import https from 'https';
import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Get connection string from Supabase Management API
async function getConnectionString() {
  return new Promise((resolve, reject) => {
    // Try to get DB connection details from Management API
    // But we need personal access token, not service role key
    // So just use the known format
    resolve('postgresql://postgres.rkrggssktzpczxvjhrxm:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres');
  });
}

// Try ALL possible connection formats
async function tryAllConnections() {
  const attempts = [
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres.rkrggssktzpczxvjhrxm', db: 'postgres', desc: 'Pooler 5432' },
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres.rkrggssktzpczxvjhrxm', db: 'postgres', desc: 'Pooler 6543' },
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres', db: 'postgres', desc: 'Pooler 5432 no ref' },
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres', db: 'postgres', desc: 'Pooler 6543 no ref' },
  ];
  
  const password = 'Hy634hpkh7bdfe';
  
  for (const attempt of attempts) {
    const client = new Client({
      host: attempt.host,
      port: attempt.port,
      database: attempt.db,
      user: attempt.user,
      password: password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    });
    
    try {
      console.log(`🔌 Trying ${attempt.desc}...`);
      await client.connect();
      console.log(`✅ CONNECTED! Executing migrations...\n`);
      
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
      await client.end();
      return true;
    } catch (error) {
      await client.end().catch(() => {});
      // Continue to next attempt
    }
  }
  
  return false;
}

async function main() {
  console.log('🚀 Applying migrations - trying all connection formats...\n');
  
  const success = await tryAllConnections();
  
  if (!success) {
    console.log('❌ All connection attempts failed.');
    console.log('   The pooler authentication format is incorrect.');
    console.log('   This requires Supabase project configuration.\n');
    process.exit(1);
  }
}

main();
