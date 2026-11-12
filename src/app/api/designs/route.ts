import { NextResponse } from 'next/server';
import { apiError, readJson, requestId } from '@/lib/http';
import { normalise } from '@/modules/design/normalise';
import { parseSpec } from '@/modules/design/spec';
import { currentUser } from '@/modules/identity/session';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DESIGNS = 30;

/** GET → the account's saved designs ("Save as my design"). */
export async function GET() {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to see your saved designs.', rid);
  const list = await getUserStore().listDesigns(user.uid);
  return NextResponse.json(
    { designs: list.map((d) => ({ ...d, spec: parseSpec(d.spec) })) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** POST { name, spec } → saves a design. The spec is validated and normalised on the server. */
export async function POST(req: Request) {
  const rid = requestId();
  const user = await currentUser();
  if (!user) return apiError('SIGN_IN_REQUIRED', 'Please sign in to save designs.', rid);
  const body = await readJson(req, 32 * 1024);
  if (!body.ok) return apiError(body.code, 'Invalid request.', rid);
  const { name, spec } = (body.value ?? {}) as { name?: unknown; spec?: unknown };
  const label = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  if (!label) return apiError('INVALID_INPUT', 'Please give the design a name.', rid);
  const store = getUserStore();
  const existing = await store.listDesigns(user.uid);
  if (existing.length >= MAX_DESIGNS)
    return apiError(
      'LIMIT_REACHED',
      `You can keep up to ${MAX_DESIGNS} designs. Delete one to save another.`,
      rid,
    );
  const clean = normalise(parseSpec(spec)).spec;
  const saved = {
    id: crypto.randomUUID(),
    uid: user.uid,
    name: label,
    spec: clean,
    createdAt: new Date().toISOString(),
  };
  await store.putDesign(saved);
  return NextResponse.json({ design: saved }, { status: 201 });
}
