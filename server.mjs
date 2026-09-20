import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSortingPlan, estimateContamination } from './decision-engine.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'outputs');
const port = Number(process.env.PORT || 8787);
const model = (process.env.GEMINI_MODEL && !process.env.GEMINI_MODEL.includes('3.6')) ? process.env.GEMINI_MODEL : 'gemini-1.5-flash';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
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

async function classify(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(res, 503, { error: 'Gemini is not configured. Add GEMINI_API_KEY to your environment.' });

  try {
    const body = JSON.parse(await readBody(req));
    const match = String(body.image || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return json(res, 400, { error: 'Send a JPEG, PNG, or WebP image as a data URL.' });

    const mode = body.mode === 'audit' ? 'audit' : 'sort';
    const prompt = mode === 'audit'
      ? `You are SortSmart Audit, helping a campus sanitation manager reduce waste contamination. Analyze this bin or pile photo. Return ONLY valid JSON with: contamination_score (integer 0-100, estimated share of material in the wrong stream), overall_note (one sentence), intervention (one concrete action for the facility), items (array of up to 5 objects, each with item, bin (Wet waste, Dry waste, Hazardous waste, E-waste, or Uncertain), hint, confidence (0-100), box ([left, top, right, bottom] percentages 0-100), why, wrong_bin_consequence), safety_note. Be conservative: use Uncertain when items overlap or cannot be identified. Never identify people. Do not provide medical, legal, or dangerous handling advice.`
      : `You are SortSmart, a cautious waste-segregation coach for an Indian campus pilot. Analyze every visible waste item in the photo. Return ONLY valid JSON with these keys: items (array of objects, one per clearly visible item; each object has item (short name), bin (one of Wet waste, Dry waste, Hazardous waste, E-waste, or Uncertain), hint (short local guidance), confidence (integer 0-100), box (array of four numbers [left, top, right, bottom] as percentages from 0 to 100 around the item), why (one sentence), wrong_bin_consequence (one short sentence explaining what goes wrong if this item is placed in the wrong bin)), overall_note (one sentence explaining the recommended sorting order), safety_note (one sentence). If the image is unclear, use Uncertain and say that a human should verify it. Never identify people. Do not provide medical, legal, or dangerous handling advice.`;
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

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/classify') return classify(req, res);
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  const requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const safe = normalize(requested).replace(/^([/\\])+/, '');
  try {
    const file = await readFile(join(root, safe));
    res.writeHead(200, { 'Content-Type': MIME[extname(safe)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, () => console.log(`SortSmart running at http://localhost:${port}`));
