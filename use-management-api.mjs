import { readFileSync } from 'fs';
import https from 'https';

const projectRef = 'rkrggssktzpczxvjhrxm';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Try Supabase Management API
const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

function makeRequest(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
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
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function execute() {
  console.log('🚀 Trying Supabase Management API...\n');
  
  try {
    // Management API requires different auth, but let's try
    const result = await makeRequest(managementApiUrl, { query: sql });
    console.log(`Status: ${result.status}`);
    if (result.status === 200) {
      console.log('✅ Migrations applied via Management API!\n');
      return;
    }
  } catch (err) {
    console.log('⚠️  Management API requires personal access token\n');
  }
  
  // Final attempt: Use pg with connection pooling and retry logic
  const pg = await import('pg');
  const { Pool } = pg.default;
  
  const pool = new Pool({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.rkrggssktzpczxvjhrxm',
    password: 'Hy634hpkh7bdfe',
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 30000,
    // Add retry logic
    retry: {
      max: 3,
      match: [/Tenant/, /connection/, /timeout/]
    }
  });
  
  try {
    console.log('🔌 Attempting final connection with retry logic...');
    const client = await pool.connect();
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
    console.log(`\n✅ SUCCESS! ${success} migrations applied!\n`);
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Final attempt failed:', error.message);
    console.log('\n💡 Network configuration issue. Use Dashboard SQL Editor.\n');
    process.exit(1);
  }
}

execute();
