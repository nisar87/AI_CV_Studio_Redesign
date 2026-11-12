// Firestore rules test (run inside the emulator):
//   npx firebase emulators:exec --only firestore --project demo-aicv "node scripts/rules-test.mjs"
// Loads firestore.rules, then checks that browsers (signed out, and signed in — even as the owner
// of a document) can neither read nor write any studio collection. Uses the emulator's REST API.
import { readFileSync } from 'node:fs';

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const PROJECT = 'demo-aicv';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const COLLECTIONS = [
  'users',
  'documents',
  'versions',
  'jobs',
  'usage',
  'passes',
  'paymentRequests',
  'config',
  'adminAudit',
  'metrics',
  'shares',
  'portfolios',
  'referralCodes',
  'somethingElse',
];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// The emulator accepts unsigned tokens; this one says "signed in as uid u1, admin claim".
const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
  iss: `https://securetoken.google.com/${PROJECT}`,
  aud: PROJECT,
  sub: 'u1',
  user_id: 'u1',
  admin: true,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  firebase: { sign_in_provider: 'password' },
})}.`;

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const load = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}:securityRules`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }),
});
if (!load.ok) throw new Error(`rules did not load: ${load.status} ${await load.text()}`);

// A document the server (owner token bypasses rules) created, owned by u1.
for (const c of COLLECTIONS) {
  const r = await fetch(`${BASE}/${c}/u1`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { uid: { stringValue: 'u1' } } }),
  });
  if (!r.ok) throw new Error(`seed ${c}: ${r.status}`);
}

let failures = 0;
for (const c of COLLECTIONS)
  for (const [who, auth] of [
    ['signed out', {}],
    ['signed in', { authorization: `Bearer ${token}` }],
  ])
    for (const [what, init] of [
      ['read', { method: 'GET' }],
      ['list', { method: 'GET', list: true }],
      ['write', { method: 'PATCH', body: JSON.stringify({ fields: { x: { stringValue: 'y' } } }) }],
      ['delete', { method: 'DELETE' }],
    ]) {
      const url = init.list ? `${BASE}/${c}` : `${BASE}/${c}/u1`;
      const r = await fetch(url, {
        method: init.method,
        headers: { 'content-type': 'application/json', ...auth },
        body: init.body,
      });
      const ok = r.status === 403;
      if (!ok) failures++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${who} ${what} ${c} → ${r.status}`);
    }
if (failures) {
  console.error(`${failures} rule checks failed`);
  process.exit(1);
}
console.log('All Firestore rule checks passed.');
