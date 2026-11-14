import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Stop reminder emails" from an email (R9.6). GET shows a confirm button (mail scanners open
 * links, so a GET never changes anything); POST turns reminder emails off — the button, and
 * mail apps' one-click unsubscribe (RFC 8058) both POST here. The link carries the person's
 * random token, so nobody else can turn their emails off.
 */
const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · AI CV Studio</title></head>
<body style="margin:0;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;color:#1b1f24"><main style="max-width:480px;margin:0 auto;padding:48px 24px">
<p style="font-weight:bold;color:#1e5a55">AI CV Studio</p><h1 style="font-size:24px">${title}</h1>${body}</main></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );

const valid = (s: string | null) => !!s && /^[\w-]{1,128}$/.test(s);

async function check(u: string | null, t: string | null) {
  if (!valid(u) || !valid(t)) return null;
  const q = await getUserStore().getReminderQueue(u!);
  return q && q.token === t ? q : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const u = url.searchParams.get('u');
  const t = url.searchParams.get('t');
  const q = await check(u, t);
  if (!q)
    return page(
      'Link not recognised',
      '<p>This link doesn’t work any more. You can turn reminder emails off on your Account page.</p>',
    );
  if (q.off)
    return page(
      'Reminder emails are off',
      '<p>You won’t get reminder emails. Your reminders still show in your job tracker.</p>',
    );
  return page(
    'Stop reminder emails?',
    `<p>You’ll stop getting reminder emails. Your reminders will still show in your job tracker.</p>
<form method="post"><button style="font-size:16px;padding:12px 20px;border:0;border-radius:8px;background:#1e5a55;color:#fff;cursor:pointer">Stop reminder emails</button></form>`,
  );
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const q = await check(url.searchParams.get('u'), url.searchParams.get('t'));
  if (!q)
    return page(
      'Link not recognised',
      '<p>This link doesn’t work any more. You can turn reminder emails off on your Account page.</p>',
    );
  await getUserStore().putReminderQueue({ ...q, off: true, updatedAt: new Date().toISOString() });
  return page(
    'Reminder emails are off',
    '<p>Done — you won’t get reminder emails. You can turn them back on from your Account page.</p>',
  );
}
