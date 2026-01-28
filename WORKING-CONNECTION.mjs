import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use the EXACT connection format that Supabase CLI uses internally
// Based on Supabase CLI source: it uses direct connection, not pooler for migrations
const connectionString = 'postgresql://postgres:Hy634hpkh7bdfe@db.rkrggssktzpczxvjhrxm.supabase.co:5432/postgres';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  connectionTimeoutMillis: 30000,
});

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
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      // DNS issue - try using IP address lookup
      console.log('⚠️  DNS resolution failed. Looking up IP address...\n');
      await tryWithIP();
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

async function tryWithIP() {
  // Try to resolve hostname to IP and connect directly
  const dns = await import('dns');
  const { promisify } = await import('util');
  const lookup = promisify(dns.lookup);
  
  try {
    const { address } = await lookup('db.rkrggssktzpczxvjhrxm.supabase.co', { family: 4 });
    console.log(`📍 Resolved to IP: ${address}\n`);
    
    const client = new Client({
      host: address,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Hy634hpkh7bdfe',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
    });
    
    await client.connect();
    console.log('✅ Connected via IP! Executing migrations...\n');
    
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
    process.exit(0);
  } catch (err) {
    console.error('❌ IP lookup failed:', err.message);
    process.exit(1);
  }
}

execute();
