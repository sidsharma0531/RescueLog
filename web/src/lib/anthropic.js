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

CRITICAL — ACCOUNT FOR HIDDEN AND OBSCURED FOOD:
Real pop-up tables hold more food than is directly visible. A camera sees the top and front layer; it misses what is stacked behind, packed below, or sealed inside boxes. Your total MUST reflect the full likely amount, not just the visible surface. Specifically:
- When items are stacked or in multiple layers, estimate the FULL stack, not just the visible top layer. Boxes and crates are typically filled, not single-layer.
- When you see sealed or closed boxes/crates, assume they contain food consistent with the surrounding category and ESTIMATE their contents (do not exclude them). A standard filled produce/banana box holds ~30-40 lbs; a filled case of canned goods ~25-35 lbs; a full bakery tray ~8-15 lbs.
- When items extend beyond the frame or are partially cut off, estimate the likely full quantity present.
- When bags or containers obscure their contents, estimate based on typical fill.
- Account for the well-documented fact that visual estimates of dense produce (potatoes, citrus, apples, root vegetables) tend to UNDERESTIMATE actual weight — these are heavier than they appear. Calibrate upward for dense items.

WEIGHT REFERENCE TABLE (anchor estimates to these, pick a SINGLE point estimate, not a range):
- Gallon of milk: 8.6 lbs | dozen eggs: 1.5 lbs | loaf of bread: 1.5 lbs
- Standard grocery bag of mixed produce: 7 lbs
- Filled banana/produce box, light items (greens, berries): 20 lbs
- Filled banana/produce box, dense items (citrus, apples, potatoes, onions): 35 lbs
- Case of canned goods: 30 lbs | flat of bottled beverages: 25 lbs
- Full bakery tray/rack of bread or pastries: 12 lbs
- Clamshell of berries/cut fruit: 1 lb | bag of salad greens: 0.7 lbs
- Tray of packaged meat: 6 lbs each | prepared meal container: 1.2 lbs each

ESTIMATION RULES:
- Produce the most realistic COMPLETE estimate — reflecting all food likely present including hidden/stacked/sealed portions. Do not deliberately underestimate; aim for the true total.
- Pick a single point estimate per category, not a range, for consistency.
- Round all weights to the nearest whole number.

CONFIDENCE SCORING (0.0 to 1.0) — this reflects your CERTAINTY, and is separate from the weight estimate. Estimate the full weight regardless of confidence; use confidence to express how sure you are:
- 0.9+ : Items clearly visible, countable, recognizable packaging.
- 0.7-0.9 : Most items visible, some estimation for stacked/grouped items.
- 0.5-0.7 : Significant portions obscured or sealed (you still estimate them — just at lower confidence).
- Below 0.5 : Poor visibility — explain in notes.

In the "notes" field, briefly state what you estimated for hidden/sealed/stacked items so the reasoning is transparent.

Only include a category in "categories" if items belonging to it are present or reasonably inferred. "total_estimated_weight_lbs" must equal the sum of every category's "estimated_weight_lbs". "image_quality" must be "good", "fair", or "poor".`;

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
          items: { type: 'array', items: { type: 'string' } },
          estimated_count: { type: 'integer' },
          estimated_weight_lbs: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: [
          'name',
          'items',
          'estimated_count',
          'estimated_weight_lbs',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
    total_estimated_weight_lbs: { type: 'number' },
    overall_confidence: { type: 'number' },
    notable_items: { type: 'array', items: { type: 'string' } },
    image_quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
    notes: { type: 'string' },
  },
  required: [
    'categories',
    'total_estimated_weight_lbs',
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
    max_tokens: 3000,
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
    ? raw.categories.map((c) => ({
        name: String(c?.name || 'other'),
        items: Array.isArray(c?.items) ? c.items.map(String) : [],
        estimated_count: Number(c?.estimated_count) || 0,
        estimated_weight_lbs: Math.max(0, Math.round(Number(c?.estimated_weight_lbs) || 0)),
        confidence: clamp01(Number(c?.confidence)),
      }))
    : [];

  const summedWeight = categories.reduce((s, c) => s + c.estimated_weight_lbs, 0);

  return {
    categories,
    total_estimated_weight_lbs:
      Math.round(Number(raw?.total_estimated_weight_lbs)) || summedWeight,
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

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
