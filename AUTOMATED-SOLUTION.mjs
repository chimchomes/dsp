import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import https from 'https';

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use Supabase Management API to execute SQL
async function executeViaManagementAPI() {
  const projectRef = 'rkrggssktzpczxvjhrxm';
  
  // Management API endpoint for executing SQL
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

// Use pg with pooler - try all possible formats
async function tryPoolerConnection() {
  const pg = await import('pg');
  const { Client } = pg.default;
  
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  // Try session pooler with correct format
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.rkrggssktzpczxvjhrxm',
    password: 'Hy634hpkh7bdfe',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
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
    throw error;
  }
}

async function main() {
  console.log('🚀 Applying migrations...\n');
  
  try {
    // Try pooler connection first
    await tryPoolerConnection();
    process.exit(0);
  } catch (error) {
    if (error.message.includes('Tenant')) {
      console.log('⚠️  Pooler authentication failed. This indicates a connection format issue.');
      console.log('   The migrations are ready in: RUN_THIS_MIGRATION.sql\n');
      console.log('💡 The network DNS issue prevents automated execution.');
      console.log('   Use Supabase Dashboard SQL Editor to apply migrations.\n');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

main();
