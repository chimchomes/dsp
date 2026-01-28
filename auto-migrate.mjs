import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const password = 'Hy634hpkh7bdfe';
const projectRef = 'rkrggssktzpczxvjhrxm';

console.log('🔗 Linking Supabase project...');

// Link the project
const linkProcess = spawn('npx', ['supabase', 'link', '--project-ref', projectRef, '--skip-pooler', '--password', password], {
  stdio: 'inherit',
  shell: true
});

linkProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Linked! Pushing migrations...\n');
    
    // Push migrations
    const pushProcess = spawn('npx', ['supabase', 'db', 'push', '--linked', '--include-all', '--yes'], {
      stdio: 'inherit',
      shell: true
    });
    
    pushProcess.on('close', (pushCode) => {
      if (pushCode === 0) {
        console.log('\n✅ Migrations applied successfully!');
      } else {
        console.log(`\n❌ Migration push failed with code ${pushCode}`);
        process.exit(pushCode);
      }
    });
  } else {
    console.log(`\n❌ Linking failed with code ${code}`);
    process.exit(code);
  }
});
