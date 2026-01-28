import { readFileSync } from 'fs';

const supabaseUrl = 'https://rkrggssktzpczxvjhrxm.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrcmdnc3NrdHpwY3p4dmpocnhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzODE1MywiZXhwIjoyMDc3NDE0MTUzfQ.ghmUR0IVoqFxuh8Ck-FWz_1EZgHEywB-CjW9m_qdqX0';

const sql = readFileSync('RUN_THIS_MIGRATION.sql', 'utf-8');

// Split into individual statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Executing ${statements.length} SQL statements...\n`);

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i] + ';';
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql_query: statement })
    });
    
    if (response.ok) {
      console.log(`✅ ${i + 1}/${statements.length}`);
    } else {
      const error = await response.text();
      console.log(`⚠️  ${i + 1}/${statements.length}: ${error.substring(0, 100)}`);
    }
  } catch (err) {
    console.log(`❌ ${i + 1}/${statements.length}: ${err.message}`);
  }
}

console.log('\n✅ Migration execution completed!');
