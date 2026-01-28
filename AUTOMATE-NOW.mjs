import { spawn } from 'child_process';

// Use direct connection (not pooler) - this is what Supabase CLI uses for migrations
const connectionString = 'postgresql://postgres:Hy634hpkh7bdfe@db.rkrggssktzpczxvjhrxm.supabase.co:5432/postgres';

console.log('🚀 Pushing migrations via Supabase CLI (direct connection)...\n');

const push = spawn('npx', [
  'supabase',
  'db',
  'push',
  '--db-url', connectionString,
  '--include-all',
  '--yes'
], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_TLS_REJECT_UNAUTHORIZED: '0'
  }
});

push.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅✅✅ Migrations applied successfully! ✅✅✅\n');
  } else {
    console.log(`\n⚠️  CLI returned code ${code}`);
    if (code === 1) {
      console.log('   This is likely due to DNS/IPv6 network configuration.');
      console.log('   Migrations are ready in: RUN_THIS_MIGRATION.sql\n');
    }
  }
  process.exit(code);
});
