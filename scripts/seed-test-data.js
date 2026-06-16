// Seeds realistic demo pop-up logs so the dashboard looks alive during the
// demo. Each log gets a complete AI-style category summary (no photos —
// do 1-2 real runs through the app for those).
//
// Re-running ADDS more logs. To start fresh, run this in the Supabase SQL
// editor:  truncate popup_logs cascade;
const { supabase } = require('./_client');

// Launch-partner org id (seeded by supabase/schema.sql). All demo logs
// belong to that organization.
const ORG_ID = '00000000-0000-0000-0000-000000000001';

// Plausible Houston-area community sites (coordinates are approximate).
const LOCATIONS = [
  { name: "St. Mark's Church", address: 'Houston, TX', latitude: 29.728, longitude: -95.422 },
  { name: 'Acres Homes Community Center', address: 'Houston, TX', latitude: 29.853, longitude: -95.435 },
  { name: 'Sunnyside Multi-Service Center', address: 'Houston, TX', latitude: 29.672, longitude: -95.353 },
  { name: 'Third Ward Community Center', address: 'Houston, TX', latitude: 29.725, longitude: -95.362 },
  { name: 'Denver Harbor Family Center', address: 'Houston, TX', latitude: 29.78, longitude: -95.29 },
];

// Category weight-share profiles — gives the demo data realistic variety.
const PROFILES = [
  { produce: 0.42, meat_poultry: 0.17, dairy: 0.15, bakery_bread: 0.11, eggs: 0.06, grab_n_go: 0.05, beverages: 0.02, shelf_stable: 0.02 },
  { produce: 0.56, bakery_bread: 0.14, dairy: 0.12, meat_poultry: 0.08, eggs: 0.04, beverages: 0.03, grab_n_go: 0.03 },
  { bakery_bread: 0.33, produce: 0.29, dairy: 0.16, meat_poultry: 0.11, grab_n_go: 0.06, eggs: 0.03, shelf_stable: 0.02 },
  { produce: 0.34, meat_poultry: 0.26, dairy: 0.16, bakery_bread: 0.1, eggs: 0.07, frozen: 0.04, grab_n_go: 0.03 },
];

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function buildSummary(totalWeight, profile, driverEstimate, photoCount) {
  const keys = Object.keys(profile);
  const categories = [];
  let assigned = 0;
  keys.forEach((k, i) => {
    const w =
      i === keys.length - 1
        ? Math.max(0, totalWeight - assigned)
        : Math.round(totalWeight * profile[k]);
    if (i !== keys.length - 1) assigned += w;
    if (w > 0) categories.push({ name: k, weight_lbs: w });
  });
  categories.forEach((c) => {
    c.percentage = round1((c.weight_lbs / totalWeight) * 100);
  });
  categories.sort((a, b) => b.weight_lbs - a.weight_lbs);

  return {
    categories,
    total_weight_lbs: totalWeight,
    photo_count: photoCount,
    overall_confidence: round2(rand(0.76, 0.92)),
    driver_estimate_lbs: driverEstimate,
    estimate_difference_pct: round1(
      ((totalWeight - driverEstimate) / driverEstimate) * 100,
    ),
  };
}

async function ensureLocations() {
  const ids = {};
  for (const loc of LOCATIONS) {
    const { data: existing } = await supabase
      .from('locations')
      .select('id')
      .eq('name', loc.name)
      .maybeSingle();
    if (existing) {
      ids[loc.name] = existing.id;
      continue;
    }
    const { data, error } = await supabase
      .from('locations')
      .insert(loc)
      .select('id')
      .single();
    if (error) throw error;
    ids[loc.name] = data.id;
    console.log(`  + location "${loc.name}"`);
  }
  return ids;
}

async function main() {
  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name');
  if (!drivers || drivers.length === 0) {
    console.error('\n  No drivers found — run `node seed-drivers.js` first.\n');
    process.exit(1);
  }

  console.log('Ensuring demo locations…');
  const locationIds = await ensureLocations();

  console.log('\nCreating demo pop-up logs…');
  const dayOffsets = [1, 2, 4, 6, 8, 11, 13, 16, 19, 22, 25, 27];
  let created = 0;

  for (const offset of dayOffsets) {
    const loc = pick(LOCATIONS);
    const driver = pick(drivers);
    const profile = pick(PROFILES);
    const totalWeight = Math.round(rand(220, 660));
    const photoCount = Math.floor(rand(3, 8));
    // A driver eyeballs the weight — round to the nearest 25 lbs.
    const driverEstimate =
      Math.round((totalWeight * rand(0.86, 1.12)) / 25) * 25;

    const loggedAt = new Date();
    loggedAt.setDate(loggedAt.getDate() - offset);
    loggedAt.setHours(10 + Math.floor(rand(0, 6)), Math.floor(rand(0, 60)), 0, 0);

    const { error } = await supabase.from('popup_logs').insert({
      driver_id: driver.id,
      organization_id: ORG_ID,
      location_id: locationIds[loc.name],
      latitude: loc.latitude,
      longitude: loc.longitude,
      driver_weight_estimate: driverEstimate,
      ai_total_weight: totalWeight,
      ai_category_summary: buildSummary(
        totalWeight,
        profile,
        driverEstimate,
        photoCount,
      ),
      status: 'complete',
      photo_count: photoCount,
      logged_at: loggedAt.toISOString(),
      processed_at: loggedAt.toISOString(),
    });
    if (error) throw error;
    created += 1;
    console.log(
      `  + ${loc.name} — ${totalWeight} lbs, ${photoCount} photos (${offset}d ago)`,
    );
  }

  console.log(`\nDone — ${created} demo pop-up logs created.`);
  console.log(
    'Re-running adds more. To start fresh: `truncate popup_logs cascade;`' +
      ' in the Supabase SQL editor.\n',
  );
}

main().catch((e) => {
  console.error('\nSeed failed:', e.message || e, '\n');
  process.exit(1);
});
