// Fails if the AI key or server-only AI code reaches files served to browsers.
// Usage: GEMINI_API_KEY=<sentinel> npm run build && GEMINI_API_KEY=<sentinel> node scripts/check-client-secrets.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = '.next/static';
const key = process.env.GEMINI_API_KEY ?? '';
const needles = [
  ...(key.length >= 8 ? [key] : []),
  'GEMINI_API_KEY',
  'x-goog-api-key',
  'generativelanguage.googleapis.com',
  'You help ordinary people write their CV', // server-side prompt text
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

let scanned = 0;
const hits = [];
for (const f of files(root)) {
  if (!/\.(js|css|html|json|map|txt)$/.test(f)) continue;
  scanned++;
  const text = readFileSync(f, 'utf8');
  for (const n of needles)
    if (text.includes(n)) hits.push(`${f}: ${n === key ? '<the API key>' : n}`);
}
if (!key) console.warn('Note: GEMINI_API_KEY not set — checked for names and server code only.');
if (hits.length) {
  console.error(`Secrets or server-only AI code found in client files:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`OK: ${scanned} client files checked, no AI key or server-only AI code.`);
