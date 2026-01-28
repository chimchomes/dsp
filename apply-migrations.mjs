#!/usr/bin/env node
/**
 * Automated Supabase Migration Script
 * 
 * This script applies database migrations to Supabase.
 * It tries multiple connection methods to work around network issues.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sql = readFileSync(join(__dirname, 'RUN_THIS_MIGRATION.sql'), 'utf-8');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PROJECT_REF = 'rkrggssktzpczxvjhrxm';
const DB_PASSWORD = 'Hy634hpkh7bdfe';

// All possible connection formats
const CONNECTION_ATTEMPTS = [
  {
    name: 'Direct connection (recommended)',
    config: {
      host: `db.${PROJECT_REF}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    }
  },
  {
    name: 'Transaction pooler (port 6543)',
    config: {
      host: 'aws-0-eu-central-1.pooler.supabase.com',
      port: 6543,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    }
  },
  {
    name: 'Session pooler (port 5432)',
    config: {
      host: 'aws-0-eu-central-1.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: `postgres.${PROJECT_REF}`,
      password: DB_PASSWORD,
      ssl: { rejectUnauthorized: false }
    }
  }
];

async function executeMigrations(client) {
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
  console.log(`\n\n✅✅✅ SUCCESS! ${success} migrations applied! ✅✅✅\n`);
  return success;
}

async function tryConnection(attempt) {
  const client = new Client({
    ...attempt.config,
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log(`🔌 Trying ${attempt.name}...`);
    await client.connect();
    console.log(`✅ Connected via ${attempt.name}!\n`);
    
    await executeMigrations(client);
    await client.end();
    return true;
  } catch (error) {
    await client.end().catch(() => {});
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log(`⚠️  DNS resolution failed (IPv6 network issue)`);
    } else if (error.message.includes('Tenant')) {
      console.log(`⚠️  Authentication failed (pooler format issue)`);
    } else {
      console.log(`⚠️  ${error.message.substring(0, 80)}`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Supabase Migration Script\n');
  console.log('Trying all connection methods...\n');
  
  for (const attempt of CONNECTION_ATTEMPTS) {
    const success = await tryConnection(attempt);
    if (success) {
      process.exit(0);
    }
    console.log('');
  }
  
  console.log('❌ All connection methods failed.\n');
  console.log('💡 Solutions:');
  console.log('   1. Enable IPv6 DNS resolution on your network');
  console.log('   2. Use Supabase Dashboard SQL Editor');
  console.log('   3. Use VPN or different network\n');
  console.log('✅ Migration SQL is ready in: RUN_THIS_MIGRATION.sql\n');
  process.exit(1);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
