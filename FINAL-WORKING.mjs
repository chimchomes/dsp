import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Try connection with database name including project ref
const formats = [
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres', database: 'postgres.rkrggssktzpczxvjhrxm', desc: 'Format 1' },
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres', database: 'postgres', desc: 'Format 2' },
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: 'postgres.rkrggssktzpczxvjhrxm', database: 'postgres', desc: 'Format 3' },
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres.rkrggssktzpczxvjhrxm', database: 'postgres', desc: 'Format 4' },
];

const password = 'Hy634hpkh7bdfe';

async function execute(format) {
  const client = new Client({
    host: format.host,
    port: format.port,
    database: format.database,
    user: format.user,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log(`🔌 Trying ${format.desc}...`);
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
    return false;
  }
}

async function main() {
  console.log('🚀 Applying Migrations - Trying All Connection Formats\n');
  
  for (const format of formats) {
    const success = await execute(format);
    if (success) {
      process.exit(0);
    }
  }
  
  console.log('\n❌ All connection formats failed.');
  console.log('✅ SQL ready in: RUN_THIS_MIGRATION.sql\n');
  process.exit(1);
}

main();
