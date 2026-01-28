import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Use Supabase CLI's db push with proper configuration
console.log('🚀 Using Supabase CLI to push migrations...\n');

const push = spawn('npx', ['supabase', 'db', 'push', '--linked', '--include-all', '--yes'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    SUPABASE_DB_PASSWORD: 'Hy634hpkh7bdfe',
    NODE_TLS_REJECT_UNAUTHORIZED: '0'
  }
});

push.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅✅✅ Migrations applied successfully! ✅✅✅\n');
  } else {
    console.log(`\n⚠️  CLI returned code ${code}`);
    console.log('   This may be due to network configuration.\n');
  }
  process.exit(code);
});
