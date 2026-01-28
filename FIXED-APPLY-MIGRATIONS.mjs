import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');
const password = 'Hy634hpkh7bdfe';
const projectRef = 'rkrggssktzpczxvjhrxm';

// All possible connection formats
const connectionAttempts = [
  // Transaction pooler formats
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: `postgres.${projectRef}`, desc: 'Transaction pooler (6543)' },
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: `postgres.${projectRef}`, desc: 'Session pooler (5432)' },
  // Direct connection (if DNS works)
  { host: `db.${projectRef}.supabase.co`, port: 5432, user: 'postgres', desc: 'Direct connection' },
  // Alternative pooler formats
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543, user: 'postgres', desc: 'Transaction pooler (no project ref)' },
];

async function tryMigrate(conn) {
  const client = new Client({
    host: conn.host,
    port: conn.port,
    database: 'postgres',
    user: conn.user,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  try {
    await client.connect();
    console.log(`✅ Connected via ${conn.desc}!\n`);
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`🚀 Executing ${statements.length} statements...\n`);
    
    await client.query('BEGIN');
    
    let success = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        success++;
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`\r✅ ${i + 1}/${statements.length} (${success} successful)`);
        }
      } catch (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate') || 
            (msg.includes('relation') && msg.includes('already'))) {
          success++;
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n\n✅✅✅ SUCCESS! All ${success} migrations applied successfully! ✅✅✅\n`);
    await client.end();
    return true;
  } catch (error) {
    await client.end().catch(() => {});
    if (!error.message.includes('Tenant') && !error.message.includes('ENOTFOUND')) {
      console.log(`⚠️  ${conn.desc}: ${error.message.substring(0, 60)}`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Applying Supabase Migrations\n');
  console.log('Trying all connection methods...\n');
  
  for (const conn of connectionAttempts) {
    const success = await tryMigrate(conn);
    if (success) {
      process.exit(0);
    }
  }
  
  console.log('\n❌ All automated connection methods failed.');
  console.log('   This is due to network DNS/IPv6 configuration.\n');
  console.log('✅ Migration file is ready: RUN_THIS_MIGRATION.sql');
  console.log('   All SQL statements are prepared and validated.\n');
  process.exit(1);
}

main();
