import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

// Use direct connection format that works
const client = new Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.rkrggssktzpczxvjhrxm',
  password: 'Hy634hpkh7bdfe',
  ssl: { rejectUnauthorized: false },
  // Force IPv4
  connectionTimeoutMillis: 10000
});

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

async function runMigrations() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='));
    
    console.log(`🚀 Executing ${statements.length} SQL statements...\n`);
    
    let success = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      try {
        await client.query(statement);
        success++;
        if ((i + 1) % 10 === 0 || i === statements.length - 1) {
          console.log(`✅ Progress: ${i + 1}/${statements.length} (${success} success, ${skipped} skipped, ${errors} errors)`);
        }
      } catch (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate') || 
            msg.includes('does not exist') || msg.includes('relation') && msg.includes('already')) {
          skipped++;
        } else {
          errors++;
          console.log(`⚠️  Statement ${i + 1}: ${err.message.substring(0, 100)}`);
        }
      }
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   Success: ${success}, Skipped: ${skipped}, Errors: ${errors}\n`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    if (error.message.includes('Tenant')) {
      console.error('\n💡 Connection issue. Trying alternative connection method...\n');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
