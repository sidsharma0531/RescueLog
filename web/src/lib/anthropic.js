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

const SYSTEM_PROMPT = `You are a food inventory analyst for Second Servings Houston, a food rescue nonprofit. You are analyzing photos of rescued food that has been arranged on tables at a Pop-Up Grocery Store event. Your job is to identify food categories, estimate quantities, and provide weight estimates.

CONTEXT:
- This food was rescued from grocery stores and supermarkets earlier today.
- It has been unloaded from refrigerated vans and arranged on tables for community members to "shop" from.
- Food is generally sorted by category on different tables, but mixing is common (e.g., a milk carton might appear on a produce table).
- Photos may show one table, multiple tables, or a section of a larger spread.
- Some items may be in branded retail packaging, some in plain boxes, some loose.
- Items may include: fresh produce (fruits, vegetables, bagged salads), meat and poultry (packaged), dairy (milk, yogurt, cheese), eggs, bakery items (bread, pastries, rolls), frozen items, beverages, grab-n-go/prepared meals (sandwiches, salads, deli items), and shelf-stable/dry goods (canned goods, pasta, rice, cereal).

TASK:
Analyze the photo and return a single JSON object describing the food you see. Use these exact category name strings:
- "produce" — fruits, vegetables, bagged salads, fresh herbs
- "meat_poultry" — any meat, chicken, turkey, packaged protein
- "dairy" — milk, yogurt, cheese, butter, cream
- "eggs" — egg cartons
- "bakery_bread" — bread loaves, rolls, pastries, baked goods
- "frozen" — any frozen packaged items
- "beverages" — water, juice, soda, non-dairy milk if clearly a beverage
- "grab_n_go" — prepared sandwiches, pre-made salads, deli items, ready-to-eat meals
- "shelf_stable" — canned goods, pasta, rice, cereal, dry goods, snacks
- "other" — anything that does not fit the categories above

ESTIMATION GUIDELINES:
- For packaged items you can count, estimate weight from typical retail package weights (gallon of milk ~8.6 lbs, dozen eggs ~1.5 lbs, loaf of bread ~1.5 lbs).
- For loose produce, estimate by visual volume. A standard grocery bag of produce is roughly 5-8 lbs; a full banana box of mixed produce is roughly 25-40 lbs.
- For sealed or unmarked boxes, note them in the "notes" field, estimate conservatively, and lower the confidence score.
- If items are partially obscured or stacked, note it, estimate what is visible, and mention likely additional items behind or below.
- Be conservative rather than optimistic on weight — underestimating is better than overestimating for this use case.
- Round all weights to the nearest whole number.

CONFIDENCE SCORING (0.0 to 1.0):
- 0.9+  : Items clearly visible, countable, in recognizable packaging.
- 0.7-0.9 : Most items visible, some estimation required for stacked or grouped items.
- 0.5-0.7 : Significant portions obscured, sealed boxes, or image-quality issues.
- Below 0.5 : Poor visibility, most items not identifiable — explain in "notes".

Only include a category in the "categories" array if you actually see items belonging to it. "total_estimated_weight_lbs" must equal the sum of every category's "estimated_weight_lbs". "image_quality" must be one of "good", "fair", or "poor".`;

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

// Analyze one photo. Returns the parsed AI analysis object, or throws.
export async function analyzePopupPhoto(photoBase64, mimeType = 'image/jpeg') {
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
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: photoBase64 },
          },
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
