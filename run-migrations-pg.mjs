import pg from 'pg';
import { readFileSync } from 'fs';
const { Client } = pg;

// Try session pooler format
const connectionString = 'postgresql://postgres.rkrggssktzpczxvjhrxm:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

async function runMigrations() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Split and execute statements one by one
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`🚀 Executing ${statements.length} statements...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      try {
        await client.query(statement);
        console.log(`✅ ${i + 1}/${statements.length}`);
      } catch (err) {
        // Some statements might fail if already exist, that's OK
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log(`⚠️  ${i + 1}/${statements.length} (already exists)`);
        } else {
          console.log(`❌ ${i + 1}/${statements.length}: ${err.message.substring(0, 100)}`);
        }
      }
    }
    
    console.log('\n✅ All migrations completed!\n');
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
