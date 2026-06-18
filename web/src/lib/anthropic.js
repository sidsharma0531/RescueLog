import Anthropic from '@anthropic-ai/sdk';
import { CATEGORY_KEYS } from './categories';

// SERVER-ONLY. Claude Vision client + food categorization prompt.

// The plan specified claude-sonnet-4-20250514, which is deprecated (retires
// 2026-06-15). claude-sonnet-4-6 is the current Sonnet — honors the plan's
// deliberate Sonnet cost choice over Opus for this high-volume vision workload.
export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'missing-anthropic-key',
});

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Donor stores this food is rescued from, paired with the retail price tier the
// vision model should anchor an item's value to when it recognizes the store's
// branding/packaging. EXTEND THIS LIST as new donors come on board — each entry
// is interpolated into the system prompt below, so adding a store is a one-line
// change. Keep the tier description short and concrete.
const DONOR_STORES = [
  { brand: 'Whole Foods / 365', tier: 'premium pricing' },
  { brand: "Trader Joe's", tier: "Trader Joe's own (mid-range) pricing" },
  { brand: 'Kroger (incl. Private Selection / Simple Truth)', tier: 'standard grocery pricing' },
  { brand: "Antone's", tier: 'deli/prepared pricing — sandwiches & po-boys are higher-value single units' },
  { brand: 'Fiesta and other Latin/Mexican groceries', tier: 'value/standard pricing' },
];

const DONOR_STORE_LINES = DONOR_STORES.map(
  (s) => `   - ${s.brand}: ${s.tier}`,
).join('\n');

const SYSTEM_PROMPT = `You are a food inventory analyst for a food rescue organization. You are analyzing photos of rescued food arranged on tables at a Pop-Up Grocery Store event. Your job is to identify food categories and produce the most ACCURATE possible total weight estimate — one that reflects the FULL amount of food present, including items that are partially hidden.

CONTEXT:
- This food was rescued from grocery stores earlier today, unloaded from refrigerated vans, and arranged on tables for community members to shop from.
- Food is generally sorted by category, but mixing is common.
- Photos may show one table, multiple tables, or a section of a larger spread.
- Items may be in branded retail packaging, plain boxes, or loose.
- Categories include: fresh produce, meat/poultry, dairy, eggs, bakery/bread, frozen, beverages, grab-n-go/prepared, shelf-stable/dry goods.

TASK:
Analyze the photo and return a single JSON object. Use these exact category strings:
- "produce" — fruits, vegetables, bagged salads, fresh herbs
- "meat_poultry" — any meat, chicken, turkey, packaged protein
- "dairy" — milk, yogurt, cheese, butter, cream
- "eggs" — egg cartons
- "bakery_bread" — bread loaves, rolls, pastries, baked goods
- "frozen" — any frozen packaged items
- "beverages" — water, juice, soda, non-dairy milk if clearly a beverage
- "grab_n_go" — prepared sandwiches, pre-made salads, deli items, ready-to-eat meals
- "shelf_stable" — canned goods, pasta, rice, cereal, dry goods, snacks
- "other" — anything not fitting above

ACCOUNT FOR HIDDEN FOOD — BUT DO NOT ASSUME MAXIMUM FILL:
A camera sees mainly the top and front layer and misses some food stacked behind, packed below, or sealed in boxes. Include a reasonable allowance for that hidden food — but only where it is clearly implied, and never assume containers are packed to capacity unless they obviously are. The goal is the realistic true total a careful in-person count would reach, not the maximum conceivable. Specifically:
- When items are clearly stacked in multiple layers, estimate the visible stack. Do not invent depth you cannot see — if only a single layer is visible with no clear sign of more beneath, estimate roughly what is visible.
- When you see sealed or closed boxes/crates, estimate their contents, but assume a typical PARTIAL fill (about half to two-thirds) unless the box clearly looks full. Use the lower end of the reference ranges when fill is uncertain.
- When items extend beyond the frame, estimate only the portion reasonably implied, not an unbounded amount.
- When bags or containers obscure their contents, estimate a typical fill, not a maximal one.
- Dense produce (potatoes, citrus, apples, root vegetables) is modestly heavier than it appears; apply a small, realistic upward adjustment — do not maximize.

WEIGHT REFERENCE TABLE (realistic averages; pick a SINGLE point estimate, not a range; use the lower end when items are obscured or fill is uncertain):
- Gallon of milk: 8.6 lbs | dozen eggs: 1.5 lbs | loaf of bread: 1.5 lbs
- Standard grocery bag of mixed produce: 6 lbs
- Filled banana/produce box, light items (greens, berries): 15 lbs
- Filled banana/produce box, dense items (citrus, apples, potatoes, onions): 26 lbs
- Case of canned goods: 22 lbs | flat of bottled beverages: 18 lbs
- Full bakery tray/rack of bread or pastries: 9 lbs
- Clamshell of berries/cut fruit: 1 lb | bag of salad greens: 0.7 lbs
- Tray of packaged meat: 5 lbs each | prepared meal container: 1 lb each

ESTIMATION RULES:
- Aim for the realistic true total a careful in-person hand-count would reach — including clearly-present hidden/stacked/sealed food, but WITHOUT inflating. Do not deliberately underestimate, and do not pad toward the maximum.
- Pick a single point estimate per category, not a range, for consistency.
- Round all weights to the nearest whole number.

ESTIMATED RETAIL VALUE (in addition to weight):
Also estimate the ESTIMATED RETAIL DOLLAR VALUE (USD) of the food — the price the end customer would pay at the SOURCE store. Use this tiered logic, in order:
1. STORE-ANCHORED (preferred): if an item shows recognizable store branding or packaging, price it at THAT store's typical retail level:
${DONOR_STORE_LINES}
   This donor list will grow over time — apply the same store-anchored logic to any other recognizable store brand you see.
2. ITEM-ANCHORED: if the store isn't identifiable but the item is, price at general US grocery retail for that item type.
3. PREMIUM vs GENERIC: price premium/specialty items high (caviar, prime or dry-aged cuts, fresh or wild-caught seafood, imported cheese) and generic items at standard retail. Use packaging cues to tell them apart where you can (e.g. wild-caught vs farmed salmon, organic vs conventional).
Be REASONABLE, never inflated — this number goes into grant reports and donor-impact statements and must be defensible. When unsure, price conservatively toward standard retail. Round values to whole dollars.

CONFIDENCE SCORING (0.0 to 1.0) — this reflects your CERTAINTY, and is separate from the weight estimate. Estimate the full weight regardless of confidence; use confidence to express how sure you are:
- 0.9+ : Items clearly visible, countable, recognizable packaging.
- 0.7-0.9 : Most items visible, some estimation for stacked/grouped items.
- 0.5-0.7 : Significant portions obscured or sealed (you still estimate them — just at lower confidence).
- Below 0.5 : Poor visibility — explain in notes.

In the "notes" field, briefly state what you estimated for hidden/sealed/stacked items so the reasoning is transparent.

ITEMIZATION — for each category, break it into the distinct item types you see in the "items" array. Each item is an object with:
- "name": short item name, INCLUDING the store brand when visible (e.g. "365 organic spinach", "Antone's po-boy", "Kroger 2% milk")
- "quantity": estimated number of units of that item
- "weight_lbs": estimated total weight for that item line
- "value_usd": ESTIMATED RETAIL VALUE for that item line (quantity × typical unit price, or weight_lbs × per-lb price)
List the item types that make up the bulk of each category — you need not enumerate every trivial item, but the items should reasonably account for the category's weight and value. Set each category's "estimated_value_usd" to the sum of its items' "value_usd".

Only include a category in "categories" if items belonging to it are present or reasonably inferred. "total_estimated_weight_lbs" must equal the sum of every category's "estimated_weight_lbs". "total_estimated_value_usd" must equal the sum of every category's "estimated_value_usd". "image_quality" must be "good", "fair", or "poor".`;

// JSON Schema for structured output — guarantees a parseable response shape.
// Note: numeric range constraints are not supported by structured outputs,
// so confidence/weight ranges are enforced via the prompt instead.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: CATEGORY_KEYS },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                weight_lbs: { type: 'number' },
                value_usd: { type: 'number' },
              },
              required: ['name', 'quantity', 'weight_lbs', 'value_usd'],
              additionalProperties: false,
            },
          },
          estimated_count: { type: 'integer' },
          estimated_weight_lbs: { type: 'number' },
          estimated_value_usd: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: [
          'name',
          'items',
          'estimated_count',
          'estimated_weight_lbs',
          'estimated_value_usd',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
    total_estimated_weight_lbs: { type: 'number' },
    total_estimated_value_usd: { type: 'number' },
    overall_confidence: { type: 'number' },
    notable_items: { type: 'array', items: { type: 'string' } },
    image_quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
    notes: { type: 'string' },
  },
  required: [
    'categories',
    'total_estimated_weight_lbs',
    'total_estimated_value_usd',
    'overall_confidence',
    'notable_items',
    'image_quality',
    'notes',
  ],
  additionalProperties: false,
};

// Run the vision request for a single image source and return the parsed
// analysis. `imageSource` is a Claude image-source object — either
// { type: 'base64', media_type, data } or { type: 'url', url }.
async function runAnalysis(imageSource) {
  const response = await client.messages.create({
    model: MODEL,
    // Headroom for the per-item itemization (name/quantity/weight/value per
    // line) so large spreads don't truncate the structured JSON.
    max_tokens: 4096,
    // Deterministic sampling to minimize run-to-run variance on the same
    // photo. (Vision estimation is never perfectly reproducible, but
    // temperature 0 removes the largest source of variance.)
    temperature: 0,
    // System prompt is identical on every photo — cache it. (Caching only
    // kicks in above the model's minimum prefix length; harmless otherwise.)
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    output_config: {
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: imageSource },
          {
            type: 'text',
            text: 'Analyze this photo of rescued food at a Pop-Up Grocery Store and return the JSON object.',
          },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Model declined to analyze this image.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('Model response contained no text content.');
  }

  return parseAnalysis(textBlock.text);
}

// Analyze one photo from base64 bytes. Returns the parsed AI analysis.
export async function analyzePopupPhoto(photoBase64, mimeType = 'image/jpeg') {
  return runAnalysis({ type: 'base64', media_type: mimeType, data: photoBase64 });
}

// Analyze one photo from a public URL. The mobile app now uploads photos
// straight to Supabase Storage and sends us the URLs, so Claude Vision
// fetches the image itself — no base64 round-trip through our API.
export async function analyzePopupPhotoFromUrl(imageUrl) {
  return runAnalysis({ type: 'url', url: imageUrl });
}

// Parse + normalize the model output. Structured outputs guarantee valid
// JSON, but we strip code fences and normalize as defense-in-depth.
function parseAnalysis(text) {
  const cleaned = text.replace(/```json\s*|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Could not parse model response as JSON: ${e.message}`);
  }
  return normalizeAnalysis(parsed);
}

function normalizeAnalysis(raw) {
  const categories = Array.isArray(raw?.categories)
    ? raw.categories.map((c) => {
        const items = normalizeItems(c?.items);
        const itemValueSum = items.reduce((s, it) => s + it.value_usd, 0);
        const rawValue = Number(c?.estimated_value_usd);
        return {
          name: String(c?.name || 'other'),
          items,
          estimated_count: Number(c?.estimated_count) || 0,
          estimated_weight_lbs: Math.max(0, Math.round(Number(c?.estimated_weight_lbs) || 0)),
          // Prefer the model's category value; fall back to summing its items.
          estimated_value_usd:
            Number.isFinite(rawValue) && rawValue >= 0
              ? round2(rawValue)
              : round2(itemValueSum),
          confidence: clamp01(Number(c?.confidence)),
        };
      })
    : [];

  const summedWeight = categories.reduce((s, c) => s + c.estimated_weight_lbs, 0);
  const summedValue = categories.reduce((s, c) => s + c.estimated_value_usd, 0);
  const rawTotalValue = Number(raw?.total_estimated_value_usd);

  return {
    categories,
    total_estimated_weight_lbs:
      Math.round(Number(raw?.total_estimated_weight_lbs)) || summedWeight,
    total_estimated_value_usd:
      Number.isFinite(rawTotalValue) && rawTotalValue >= 0
        ? round2(rawTotalValue)
        : round2(summedValue),
    overall_confidence: clamp01(Number(raw?.overall_confidence)),
    notable_items: Array.isArray(raw?.notable_items)
      ? raw.notable_items.map(String)
      : [],
    image_quality: ['good', 'fair', 'poor'].includes(raw?.image_quality)
      ? raw.image_quality
      : 'fair',
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
  };
}

// Items may arrive as objects (current schema: name/quantity/weight_lbs/
// value_usd) or, defensively, as plain strings (older stored analyses).
// Normalize to a consistent object shape.
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    if (typeof it === 'string') {
      return { name: it, quantity: 0, weight_lbs: 0, value_usd: 0 };
    }
    return {
      name: String(it?.name || ''),
      quantity: Math.max(0, Math.round(Number(it?.quantity) || 0)),
      weight_lbs: Math.max(0, round1(Number(it?.weight_lbs) || 0)),
      value_usd: Math.max(0, round2(Number(it?.value_usd) || 0)),
    };
  });
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
