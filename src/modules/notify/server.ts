import 'server-only';
import type { PaymentRequest } from '@/modules/store/types';

/**
 * Emails from the studio (spec §6 R5: payment emails). SMTP through the owner's Namecheap Private
 * Email mailbox: SMTP_HOST (default mail.privateemail.com), SMTP_PORT (465, TLS), SMTP_USER (the
 * mailbox, default: the support email in the business settings) and SMTP_PASSWORD (a secret the
 * owner sets; never in code or config). Without a password, emails are skipped and logged.
 *
 * Test runs (MAIL_OUTBOX=memory, with the in-memory store) keep messages in an outbox instead.
 */
export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra headers (e.g. List-Unsubscribe for reminder emails). */
  headers?: Record<string, string>;
  /** Where a reply goes (a portfolio visitor's address for contact messages). */
  replyTo?: string;
};
export type MailResult =
  | { ok: true; id?: string }
  | { ok: false; reason: 'not_configured' | 'no_recipient' | 'failed'; message?: string };

type Outbox = Mail[];
const g = globalThis as unknown as { __cvsOutbox?: Outbox };
const outboxMode = () =>
  process.env.MAIL_OUTBOX === 'memory' && process.env.DATA_STORE === 'memory';

export function testOutbox(): Outbox {
  g.__cvsOutbox ??= [];
  return g.__cvsOutbox;
}

export function mailSettings(fallbackUser = '') {
  const user = process.env.SMTP_USER || fallbackUser;
  return {
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: Number(process.env.SMTP_PORT || 465),
    user,
    from: process.env.SMTP_FROM || (user ? `AI CV Studio <${user}>` : ''),
    configured: outboxMode() || (!!user && !!process.env.SMTP_PASSWORD),
  };
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

export async function sendMail(mail: Mail, fallbackUser = ''): Promise<MailResult> {
  if (!EMAIL.test(mail.to)) return { ok: false, reason: 'no_recipient' };
  if (outboxMode()) {
    testOutbox().push(mail);
    return { ok: true, id: `outbox-${testOutbox().length}` };
  }
  const s = mailSettings(fallbackUser);
  if (!s.configured) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        area: 'notify',
        event: 'mail_skipped',
        reason: 'not_configured',
      }),
    );
    return { ok: false, reason: 'not_configured' };
  }
  try {
    const { createTransport } = await import('nodemailer');
    const t = createTransport({
      host: s.host,
      port: s.port,
      secure: s.port === 465,
      auth: { user: s.user, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    const info = await t.sendMail({ from: s.from, ...mail });
    console.log(JSON.stringify({ level: 'info', area: 'notify', event: 'mail_sent' }));
    return { ok: true, id: info.messageId };
  } catch (e) {
    const message = (e as Error).message.slice(0, 200);
    console.error(
      JSON.stringify({ level: 'error', area: 'notify', event: 'mail_failed', message }),
    );
    return { ok: false, reason: 'failed', message };
  }
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

function wrapHtml(
  title: string,
  paragraphs: string[],
  footer = 'You get this email because you placed an order on aicvstudio.app.',
) {
  return `<!doctype html><html><body style="margin:0;background:#faf8f4;font-family:Arial,Helvetica,sans-serif;color:#1b1f24">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<p style="font-size:14px;color:#1e5a55;font-weight:bold;margin:0 0 16px">AI CV Studio</p>
<h1 style="font-size:22px;margin:0 0 16px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${p}</p>`).join('\n')}
<p style="font-size:13px;color:#5b616b;margin-top:24px">${footer}</p>
</div></body></html>`;
}

/** The site address used in emails (staging sets PUBLIC_SITE_URL to its own address). */
export const SITE = (process.env.PUBLIC_SITE_URL || 'https://aicvstudio.app').replace(/\/$/, '');
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The buyer's email when their order is approved or rejected. */
export function paymentEmail(
  p: PaymentRequest,
  opts: { expiresAt?: string | null; reason?: string; supportEmail?: string },
): Mail | null {
  if (!p.email) return null;
  const order = p.orderNo ?? p.reference;
  const help = opts.supportEmail
    ? `Questions? Reply to this email or write to ${opts.supportEmail}.`
    : 'Questions? Just reply to this email.';
  if (p.status === 'approved') {
    const until = opts.expiresAt ? fmtDate(opts.expiresAt) : '';
    const lines = [
      `Thank you — we received your payment for order ${order}. Your ${p.passLabel} is now active${until ? ` until ${until}` : ''}.`,
      `Every design, more downloads and AI help are ready for you: ${SITE}/cv`,
      help,
    ];
    return {
      to: p.email,
      subject: `Premium is active — order ${order}`,
      text: lines.join('\n\n'),
      html: wrapHtml('Your Premium is active', [
        esc(lines[0]!),
        `Every design, more downloads and AI help are ready for you: <a href="${SITE}/cv" style="color:#1e5a55">open your CVs</a>.`,
        esc(help),
      ]),
    };
  }
  if (p.status === 'rejected') {
    const lines = [
      `We couldn’t confirm the payment for order ${order}.`,
      opts.reason ? `Reason: ${opts.reason}` : '',
      `If you have paid, please send the payment screenshot with your order number on WhatsApp, or place a new order: ${SITE}/premium`,
      help,
    ].filter(Boolean);
    return {
      to: p.email,
      subject: `About your order ${order}`,
      text: lines.join('\n\n'),
      html: wrapHtml('We couldn’t confirm your payment', lines.map(esc)),
    };
  }
  return null;
}

export function testEmail(to: string): Mail {
  const text =
    'This is a test email from the AI CV Studio console. If you can read it, emails to buyers will arrive too.';
  return {
    to,
    subject: 'Test email from AI CV Studio',
    text,
    html: wrapHtml('Test email', [esc(text)]),
  };
}

/** One line per due reminder: "Follow up with Acme — Delivery Driver at Acme (due 16 Nov)". */
type DigestItem = {
  job: { id: string; title: string; company: string };
  reminder: { note: string; on: string };
};

const dayLabel = (on: string) =>
  new Date(`${on}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/**
 * The daily reminders digest (R9.6). Every reminder links to its job; the email and its headers
 * carry a one-click way to stop reminder emails (RFC 8058).
 */
export function reminderEmail(
  to: string,
  items: DigestItem[],
  opts: { today: string; unsubscribeUrl: string },
): Mail {
  const line = (i: DigestItem) => {
    const job = `${i.job.title}${i.job.company ? ` at ${i.job.company}` : ''}`;
    const when = i.reminder.on < opts.today ? ` (since ${dayLabel(i.reminder.on)})` : '';
    return {
      text: `${i.reminder.note || 'Reminder'} — ${job}${when}`,
      url: `${SITE}/jobs/${i.job.id}`,
    };
  };
  const lines = items.map(line);
  const n = items.length;
  const subject =
    n === 1
      ? `Reminder: ${items[0]!.reminder.note || items[0]!.job.title}`
      : `${n} reminders for today`;
  const text = [
    n === 1 ? 'You asked us to remind you today:' : `You asked us to remind you about ${n} things:`,
    ...lines.map((l) => `- ${l.text}\n  ${l.url}`),
    `All your jobs: ${SITE}/jobs`,
    `Stop reminder emails: ${opts.unsubscribeUrl}`,
  ].join('\n\n');
  const html = wrapHtml(
    n === 1 ? 'Your reminder for today' : 'Your reminders for today',
    [
      ...lines.map(
        (l) => `<a href="${esc(l.url)}" style="color:#1e5a55;font-weight:bold">${esc(l.text)}</a>`,
      ),
      `<a href="${SITE}/jobs" style="color:#1e5a55">Open your job tracker</a>`,
    ],
    `You get this email because you set reminders on aicvstudio.app. <a href="${esc(opts.unsubscribeUrl)}" style="color:#5b616b">Stop reminder emails</a>.`,
  );
  return {
    to,
    subject,
    text,
    html,
    headers: {
      'List-Unsubscribe': `<${opts.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

/**
 * A comment notice (R9.7). It never carries the reviewer's words or name: anyone holding the link
 * can write a comment, so the email only says there are new ones and links to the studio.
 */
export function commentEmail(
  to: string,
  opts: { cvTitle: string; open: number; docId: string },
): Mail {
  const url = `${SITE}/cv/${encodeURIComponent(opts.docId)}?tab=check#comments`;
  const settings = `${SITE}/cv/${encodeURIComponent(opts.docId)}/download`;
  const title = opts.cvTitle.trim().slice(0, 80) || 'your CV';
  const subject = `New comment on ${title}`;
  const count =
    opts.open === 1
      ? 'There is 1 comment waiting for you.'
      : `There are ${opts.open} comments waiting for you.`;
  const text = [
    `Someone you shared a link with left a comment on "${title}".`,
    count,
    `Read them in your studio: ${url}`,
    `To stop these emails or comments, change the link’s settings: ${settings}`,
  ].join('\n\n');
  const html = wrapHtml(
    'New comment on your CV',
    [
      `Someone you shared a link with left a comment on “${esc(title)}”.`,
      esc(count),
      `<a href="${esc(url)}" style="color:#1e5a55;font-weight:bold">Read the comments</a>`,
    ],
    `You get this email because comments are on for a link to your CV. <a href="${esc(settings)}" style="color:#5b616b">Change the link’s settings</a>.`,
  );
  return { to, subject, text, html };
}

/**
 * A message from a portfolio page's contact form (R9.8). The visitor's words go to the owner,
 * clearly marked as coming from someone on the internet; replying answers the visitor directly.
 * The owner's address is never shown to the visitor.
 */
export function contactEmail(
  to: string,
  m: { name: string; email: string; message: string; slug: string },
): Mail {
  const page = `${SITE}/p/${encodeURIComponent(m.slug)}`;
  const settings = `${SITE}/portfolio`;
  const name = m.name.slice(0, 80);
  const subject = `Message from ${name} through your portfolio page`;
  const note =
    'Someone used the contact form on your portfolio page. We don’t check who sends messages, so be careful with links and requests for money or personal details.';
  const text = [
    note,
    `From: ${name} <${m.email}>`,
    m.message,
    `Reply to this email to answer ${name}.`,
    `Your page: ${page}`,
    `To stop messages, turn off the contact form: ${settings}`,
  ].join('\n\n');
  const html = wrapHtml(
    'A message through your portfolio page',
    [
      `<strong>From:</strong> ${esc(name)} &lt;${esc(m.email)}&gt;`,
      `<span style="white-space:pre-wrap">${esc(m.message)}</span>`,
      `Reply to this email to answer ${esc(name)}.`,
      `<span style="color:#5b616b;font-size:13px">${esc(note)}</span>`,
    ],
    `You get this email because the contact form is on for <a href="${esc(page)}" style="color:#5b616b">your portfolio page</a>. <a href="${esc(settings)}" style="color:#5b616b">Turn it off</a>.`,
  );
  return { to, subject, text, html, replyTo: m.email };
}
