import { readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create link directory
const tempDir = join(__dirname, 'supabase', '.temp');
mkdirSync(tempDir, { recursive: true });
writeFileSync(join(tempDir, 'project-ref'), 'rkrggssktzpczxvjhrxm');

console.log('📤 Pushing migrations via CLI...\n');

const push = spawn('npx', ['supabase', 'db', 'push', '--linked', '--include-all', '--yes'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

push.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migrations applied successfully!');
  } else {
    console.log(`\n⚠️  CLI push returned code ${code}`);
    console.log('   This may be due to network/IPv6 issues.');
    console.log('   Migrations are ready in: RUN_THIS_MIGRATION.sql');
    console.log('   Apply them via Supabase Dashboard SQL Editor if needed.\n');
  }
  process.exit(code);
});
