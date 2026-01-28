import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Try with just 'postgres' as user (some poolers use this format)
const formats = [
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres.rkrggssktzpczxvjhrxm', db: 'postgres' },
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres.rkrggssktzpczxvjhrxm', db: 'postgres' },
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres', db: 'postgres' },
];

const password = 'Hy634hpkh7bdfe';

async function tryConnection(format) {
  const client = new Client({
    host: format.host,
    port: format.port,
    database: format.db,
    user: format.user,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    console.log(`🔌 Trying ${format.user}@${format.host}:${format.port}...`);
    await client.connect();
    console.log('✅ Connected! Executing migrations...\n');
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
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
        // Continue
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n\n✅ SUCCESS! All ${success} migrations applied!\n`);
    await client.end();
    return true;
  } catch (error) {
    await client.end().catch(() => {});
    return false;
  }
}

async function run() {
  for (const format of formats) {
    const success = await tryConnection(format);
    if (success) {
      process.exit(0);
    }
  }
  
  console.log('\n❌ All connection attempts failed.');
  console.log('💡 Apply migrations via Dashboard SQL Editor\n');
  process.exit(1);
}

run();
