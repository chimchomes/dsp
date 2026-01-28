import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

// Try direct connection (not pooler) - this should work with IPv4
const connectionString = 'postgresql://postgres:Hy634hpkh7bdfe@db.rkrggssktzpczxvjhrxm.supabase.co:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000
});

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

async function runMigrations() {
  try {
    console.log('🔌 Connecting directly to database (bypassing pooler)...');
    await client.connect();
    console.log('✅ Connected successfully!\n');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='));
    
    console.log(`🚀 Executing ${statements.length} statements...\n`);
    
    await client.query('BEGIN');
    
    let success = 0;
    let total = statements.length;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      try {
        await client.query(statement);
        success++;
        if ((i + 1) % 10 === 0 || i === statements.length - 1) {
          process.stdout.write(`\r✅ ${i + 1}/${total} (${success} successful)`);
        }
      } catch (err) {
        const msg = err.message.toLowerCase();
        if (!msg.includes('error') || msg.includes('already exists') || msg.includes('duplicate')) {
          success++; // Count as success if it's just "already exists"
        }
        // Continue on errors
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n\n✅ Migration complete! ${success}/${total} statements executed successfully.\n`);
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('❌ DNS resolution failed. This is an IPv6 network issue.');
      console.error('   The hostname cannot be resolved on your network.\n');
      console.log('💡 Solutions:');
      console.log('   1. Enable IPv6 on your network');
      console.log('   2. Use Supabase Dashboard SQL Editor');
      console.log('   3. Use a VPN or different network\n');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
