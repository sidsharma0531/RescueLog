// Per-organization price-reference overrides.
//
// The vision model already estimates a retail value for every item it sees.
// An org can ALSO pin an exact price for items they receive repeatedly
// (e.g. "Antone's po-boy = $9 each"). After analysis, we match each identified
// item against the org's price references and, where one matches, replace that
// item's value with the pinned price — adjusting its category total by the
// difference so unmatched items keep their AI-estimated value.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Normalize a name for matching: lowercase, strip punctuation to spaces,
// collapse whitespace. "Antone's Po-Boy!" -> "antone s po boy".
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(name) {
  return normalizeName(name).split(' ').filter(Boolean);
}

const subset = (a, b) => a.length > 0 && a.every((t) => b.includes(t));

// Heuristic name match: exact (normalized) OR one name's tokens are a subset of
// the other's. So a reference "Antone's sandwich" matches an item named
// "Antone's turkey sandwich", and vice versa.
function namesMatch(itemName, refName) {
  const a = normalizeName(itemName);
  const b = normalizeName(refName);
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = tokenize(a);
  const tb = tokenize(b);
  return subset(tb, ta) || subset(ta, tb);
}

// Find the first price reference whose item_name matches the given item name.
function findMatch(itemName, refs) {
  return refs.find((r) => namesMatch(itemName, r.item_name)) || null;
}

// Return a copy of one photo's analysis with org price references applied.
// `priceRefs`: [{ item_name, price_usd, unit: 'per_unit'|'per_lb' }].
export function applyPriceReferences(analysis, priceRefs) {
  if (!analysis || !Array.isArray(analysis.categories)) return analysis;
  const refs = (priceRefs || []).filter(
    (r) => r && r.item_name && r.price_usd != null,
  );
  if (refs.length === 0) return analysis;

  let total = 0;
  const categories = analysis.categories.map((c) => {
    let catValue = Number(c.estimated_value_usd) || 0;
    const items = (c.items || []).map((it) => {
      const match = findMatch(it.name, refs);
      if (!match) return it;
      const price = Number(match.price_usd) || 0;
      const override =
        match.unit === 'per_lb'
          ? (Number(it.weight_lbs) || 0) * price
          : (Number(it.quantity) || 0) * price;
      const newValue = round2(Math.max(0, override));
      catValue += newValue - (Number(it.value_usd) || 0);
      return { ...it, value_usd: newValue, price_overridden: true };
    });
    catValue = round2(Math.max(0, catValue));
    total += catValue;
    return { ...c, items, estimated_value_usd: catValue };
  });

  return { ...analysis, categories, total_estimated_value_usd: round2(total) };
}
