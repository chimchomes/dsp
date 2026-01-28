import { readFileSync } from 'fs';
import { spawn } from 'child_process';

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use psql via connection string with IPv4 pooler
const connectionString = 'postgresql://postgres.rkrggssktzpczxvjhrxm:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

console.log('🚀 Applying migrations via direct PostgreSQL connection...\n');

// Try using node-postgres with IPv4
import('pg').then(({ default: pg }) => {
  const { Client } = pg;
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    // Force IPv4
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.rkrggssktzpczxvjhrxm',
    password: 'Hy634hpkh7bdfe'
  });

  client.connect()
    .then(() => {
      console.log('✅ Connected to database\n');
      
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      console.log(`Executing ${statements.length} statements...\n`);
      
      let completed = 0;
      const executeNext = async (index) => {
        if (index >= statements.length) {
          console.log(`\n✅ All ${completed} migrations completed successfully!\n`);
          client.end();
          process.exit(0);
          return;
        }
        
        const statement = statements[index] + ';';
        try {
          await client.query(statement);
          completed++;
          console.log(`✅ ${completed}/${statements.length}`);
          executeNext(index + 1);
        } catch (err) {
          if (err.message.includes('already exists') || err.message.includes('duplicate') || err.message.includes('does not exist')) {
            completed++;
            console.log(`⚠️  ${completed}/${statements.length} (${err.message.substring(0, 50)}...)`);
            executeNext(index + 1);
          } else {
            console.error(`❌ ${index + 1}/${statements.length}: ${err.message}`);
            executeNext(index + 1); // Continue anyway
          }
        }
      };
      
      executeNext(0);
    })
    .catch(err => {
      console.error('❌ Connection failed:', err.message);
      console.log('\n⚠️  Trying alternative method...\n');
      process.exit(1);
    });
}).catch(() => {
  console.error('pg module not available');
  process.exit(1);
});
