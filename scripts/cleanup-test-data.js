// Inspects (default) or deletes (--delete) popup_logs whose effective
// location name contains "test". popup_photos are removed automatically
// via the popup_logs -> popup_photos cascade.
//
//   node cleanup-test-data.js            # dry run — shows what matches
//   node cleanup-test-data.js --delete   # actually delete
const { supabase } = require('./_client');

const DELETE = process.argv.includes('--delete');
const PATTERNS = ['test'];

const matches = (name) => {
  const n = (name || '').toLowerCase();
  return PATTERNS.some((p) => n.includes(p));
};

async function main() {
  const { data: locations, error: lErr } = await supabase
    .from('locations')
    .select('id, name');
  if (lErr) throw lErr;
  const locName = new Map((locations || []).map((l) => [l.id, l.name]));

  const { data: logs, error: pErr } = await supabase
    .from('popup_logs')
    .select('id, location_id, location_name_manual');
  if (pErr) throw pErr;

  // Group log ids by their effective location name.
  const groups = new Map();
  for (const log of logs || []) {
    const name = log.location_id
      ? locName.get(log.location_id) || '(unknown location)'
      : log.location_name_manual || '(no location name)';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(log.id);
  }

  const idsToDelete = [];
  console.log('\nPop-up logs by location name:\n');
  for (const [name, ids] of [...groups.entries()].sort()) {
    const hit = matches(name);
    if (hit) idsToDelete.push(...ids);
    console.log(
      `  ${hit ? 'DELETE' : ' keep '}  ${name.padEnd(38)} ${ids.length} log(s)`,
    );
  }

  console.log(
    `\nTotal: ${logs?.length || 0} pop-up logs · ${idsToDelete.length} match "test".`,
  );

  if (!DELETE) {
    console.log('\nDry run — nothing deleted. Re-run with --delete to apply.\n');
    return;
  }
  if (idsToDelete.length === 0) {
    console.log('\nNothing to delete.\n');
    return;
  }
  const { error: dErr } = await supabase
    .from('popup_logs')
    .delete()
    .in('id', idsToDelete);
  if (dErr) throw dErr;
  console.log(
    `\nDeleted ${idsToDelete.length} pop-up log(s); their popup_photos cascaded.\n`,
  );
}

main().catch((e) => {
  console.error('\nFailed:', e.message || e, '\n');
  process.exit(1);
});
