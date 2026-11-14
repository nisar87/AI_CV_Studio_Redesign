import { apiError, readJson } from '@/lib/http';
import { actor, json, withAdmin } from '@/modules/admin/server';
import { getBusinessConfig } from '@/modules/billing/server';
import { mailSettings, reminderEmail, sendMail, SITE, testEmail } from '@/modules/notify/server';
import { getUserStore } from '@/modules/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET → whether email is set up (never the password). */
export function GET() {
  return withAdmin(async () => {
    const { value: cfg } = await getBusinessConfig();
    const s = mailSettings(cfg.support.email);
    return json({ configured: s.configured, host: s.host, port: s.port, from: s.from });
  });
}

/** A sample reminder digest (R9.6) so the template can be checked in a real inbox. */
const sampleReminder = (to: string) =>
  reminderEmail(
    to,
    [
      {
        job: { id: 'sample', title: 'Delivery Driver', company: 'Fresh Foods Ltd' },
        reminder: {
          note: 'Follow up with Fresh Foods Ltd',
          on: new Date().toISOString().slice(0, 10),
        },
      },
    ],
    { today: new Date().toISOString().slice(0, 10), unsubscribeUrl: `${SITE}/account` },
  );

/** POST { to?, kind? } → sends a test email, or a sample reminder email (kind: 'reminder'). */
export function POST(req: Request) {
  return withAdmin(async (admin, rid) => {
    const body = await readJson(req, 1024);
    const to =
      (body.ok && typeof (body.value as { to?: unknown })?.to === 'string'
        ? (body.value as { to: string }).to.trim() || admin.email
        : admin.email) ?? '';
    const { value: cfg } = await getBusinessConfig();
    const kind =
      body.ok && (body.value as { kind?: unknown })?.kind === 'reminder' ? 'reminder' : 'test';
    const r = await sendMail(
      kind === 'reminder' ? sampleReminder(to) : testEmail(to),
      cfg.support.email,
    );
    await getUserStore().writeAudit({
      at: new Date().toISOString(),
      by: actor(admin),
      action: 'email.test',
      target: to,
      detail: { kind, ok: r.ok, ...(r.ok ? {} : { reason: r.reason }) },
    });
    if (!r.ok)
      return apiError(
        r.reason === 'no_recipient' ? 'INVALID_INPUT' : 'INTERNAL',
        r.reason === 'not_configured'
          ? 'Email is not set up yet: the mailbox password (SMTP_PASSWORD) is missing on the server.'
          : r.reason === 'no_recipient'
            ? 'Please enter a valid email address.'
            : `The mail server refused: ${r.message ?? 'unknown error'}`,
        rid,
        { reason: r.reason },
      );
    return json({ ok: true, to });
  });
}
