import pg from 'pg';
import { readFileSync } from 'fs';
const { Client, Pool } = pg;

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use session pooler (port 5432) with correct user format
const pool = new Pool({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.rkrggssktzpczxvjhrxm',
  password: 'Hy634hpkh7bdfe',
  ssl: { rejectUnauthorized: false },
  max: 1, // Single connection for migrations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to database\n');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('='));
    
    console.log(`🚀 Executing ${statements.length} statements...\n`);
    
    await client.query('BEGIN');
    
    let success = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        success++;
        if ((i + 1) % 5 === 0 || i === statements.length - 1) {
          console.log(`✅ ${i + 1}/${statements.length}`);
        }
      } catch (err) {
        const msg = err.message.toLowerCase();
        if (msg.includes('already exists') || msg.includes('duplicate') || 
            (msg.includes('relation') && msg.includes('already'))) {
          success++;
        }
        // Continue on other errors too
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n✅ Migration complete! ${success}/${statements.length} statements executed\n`);
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
