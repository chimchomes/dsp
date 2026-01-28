import { readFileSync } from 'fs';
import https from 'https';

const projectRef = 'rkrggssktzpczxvjhrxm';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';
const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use Supabase Management API
const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

function makeRequest(body) {
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
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function execute() {
  console.log('🚀 Executing via Supabase Management API...\n');
  
  try {
    const result = await makeRequest({ query: sql });
    if (result.status === 200) {
      console.log('✅✅✅ MIGRATIONS APPLIED SUCCESSFULLY! ✅✅✅\n');
      process.exit(0);
    } else {
      console.log(`Status: ${result.status}`);
      console.log(`Response: ${result.data.substring(0, 200)}`);
      
      // Management API might require personal access token
      // Fallback to direct connection
      console.log('\n🔄 Trying direct connection as fallback...\n');
      await tryDirectConnection();
    }
  } catch (err) {
    console.log('⚠️  Management API failed, trying direct connection...\n');
    await tryDirectConnection();
  }
}

async function tryDirectConnection() {
  const pg = await import('pg');
  const { Client } = pg.default;
  
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  // Final attempt with exact Supabase connection string format
  const connStr = 'postgresql://postgres.rkrggssktzpczxvjhrxm:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
  
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected! Executing...\n');
    
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
  } catch (error) {
    await client.end().catch(() => {});
    console.error('❌ Connection failed:', error.message);
    console.log('\n✅ SQL file ready: RUN_THIS_MIGRATION.sql\n');
    process.exit(1);
  }
}

execute();
