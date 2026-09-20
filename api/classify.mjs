import { buildSortingPlan, estimateContamination } from '../decision-engine.mjs';

const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 22_000_000) reject(new Error('Image request is too large.'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseModelJson(text) {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 503, { error: 'Gemini is not configured.' });

  try {
    const body = JSON.parse(await readBody(req));
    const match = String(body.image || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return json(res, 400, { error: 'Send a JPEG, PNG, or WebP image as a data URL.' });

    const mode = body.mode === 'audit' ? 'audit' : 'sort';
    const prompt = mode === 'audit'
      ? `You are SortSmart Audit, helping a campus sanitation manager reduce waste contamination. Analyze this bin or pile photo. Return ONLY valid JSON with: contamination_score (integer 0-100, estimated share of material in the wrong stream), overall_note (one sentence), intervention (one concrete action for the facility), items (array of up to 5 objects, each with item, bin (Wet waste, Dry waste, Hazardous waste, E-waste, or Uncertain), hint, confidence (0-100), box ([left, top, right, bottom] percentages 0-100), why, wrong_bin_consequence), safety_note. Be conservative: use Uncertain when items overlap or cannot be identified. Never identify people. Do not provide medical, legal, or dangerous handling advice.`
      : `You are SortSmart, an expert waste-segregation coach. Analyze every visible waste item in the photo. Categorize each item into exactly one bin:
- "Wet waste": Organic waste, food scraps, fruit peels, vegetables, leaves, tea leaves, compostables.
- "Dry waste": Clean plastic bottles, packaging, cardboard boxes, paper, aluminum cans, tins, glass bottles, foils.
- "E-waste": Phones, chargers, cables, laptops, earbuds, circuit boards, small appliances.
- "Hazardous waste": Batteries (AA, AAA, button cells, phone batteries), chemicals, paints, medicines, syringes, sharps.
- "Uncertain": Severely overlapping, dirty, unrecognizable, or mixed contaminated items.

Return ONLY valid JSON with these keys: items (array of objects, one per clearly visible item; each object has item (short descriptive name), bin (Wet waste, Dry waste, Hazardous waste, E-waste, or Uncertain), hint (short local guidance), confidence (integer 0-100), box (array of four numbers [left, top, right, bottom] as percentages from 0 to 100 around the item), why (one sentence explanation), wrong_bin_consequence (one sentence explaining what goes wrong if placed in wrong bin)), overall_note (one sentence explaining the recommended sorting order), safety_note (one sentence). Never identify people. Do not provide medical, legal, or dangerous handling advice.`;

    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: match[1], data: match[2] } }, { text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      })
    });
    const raw = await upstream.json();
    if (!upstream.ok) return json(res, upstream.status, { error: raw?.error?.message || 'Gemini request failed.' });
    const text = raw?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    const result = parseModelJson(text);
    if (mode === 'sort') {
      const plan = buildSortingPlan(result.items || []);
      return json(res, 200, { ...result, ...plan, intelligence: 'policy-checked' });
    }
    const audit = body.observedBin ? estimateContamination(result.items || [], body.observedBin) : null;
    return json(res, 200, { ...result, audit, intelligence: 'policy-checked' });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Unable to classify this image.' });
  }
}
