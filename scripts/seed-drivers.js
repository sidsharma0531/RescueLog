// Seed driver and admin login accounts. Safe to re-run — skips accounts
// that already exist.
const bcrypt = require('bcryptjs');
const { supabase } = require('./_client');

const DRIVERS = [
  { name: 'Greg', pin: '1234' },
  { name: 'Maria', pin: '2345' },
  { name: 'Devon', pin: '3456' },
];

const ADMINS = [
  { name: 'Max Curry', email: 'max@secondservings.org' },
  { name: 'Lisa', email: 'lisa@secondservings.org' },
  { name: 'Barbara', email: 'barbara@secondservings.org' },
];

const ADMIN_PASSWORD = 'rescue123';

async function main() {
  console.log('Seeding driver accounts…');
  for (const d of DRIVERS) {
    const { data: existing } = await supabase
      .from('drivers')
      .select('id')
      .eq('name', d.name)
      .maybeSingle();
    if (existing) {
      console.log(`  · driver "${d.name}" already exists — skipped`);
      continue;
    }
    const { error } = await supabase.from('drivers').insert(d);
    if (error) throw error;
    console.log(`  + driver "${d.name}" (PIN ${d.pin})`);
  }

  console.log('\nSeeding admin accounts…');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  for (const a of ADMINS) {
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', a.email)
      .maybeSingle();
    if (existing) {
      console.log(`  · admin "${a.email}" already exists — skipped`);
      continue;
    }
    const { error } = await supabase
      .from('admin_users')
      .insert({ ...a, password_hash: passwordHash });
    if (error) throw error;
    console.log(`  + admin "${a.email}"`);
  }

  console.log(`\nDone. All admin accounts use password: ${ADMIN_PASSWORD}`);
  console.log('Change these credentials before any real-world use.\n');
}

main().catch((e) => {
  console.error('\nSeed failed:', e.message || e, '\n');
  process.exit(1);
});
