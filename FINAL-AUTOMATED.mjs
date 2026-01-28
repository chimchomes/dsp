import { spawn } from 'child_process';

// Use Supabase CLI with db-url to bypass link requirement
const connectionString = 'postgresql://postgres.rkrggssktzpczxvjhrxm:Hy634hpkh7bdfe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

console.log('🚀 Pushing migrations via Supabase CLI...\n');

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
    console.log(`\n❌ CLI failed with code ${code}`);
  }
  process.exit(code);
});
