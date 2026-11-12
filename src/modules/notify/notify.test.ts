import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaymentRequest } from '@/modules/store/types';
import { mailSettings, paymentEmail, sendMail, testEmail } from './server';

const order = (o: Partial<PaymentRequest>): PaymentRequest =>
  ({
    id: 'r1',
    uid: 'u1',
    email: 'buyer@example.com',
    passId: 'month',
    passLabel: '1 month',
    days: 30,
    pricePkr: 499,
    methodId: 'jazz',
    methodLabel: 'JazzCash',
    reference: '',
    orderNo: 'CV-7KQ2M9',
    status: 'approved',
    createdAt: '2026-11-12T10:00:00.000Z',
    ...o,
  }) as PaymentRequest;

afterEach(() => vi.unstubAllEnvs());

describe('payment emails', () => {
  it('says Premium is active, until when, with the order number', () => {
    const m = paymentEmail(order({}), {
      expiresAt: '2026-12-12T10:00:00.000Z',
      supportEmail: 'help@x.com',
    })!;
    expect(m.to).toBe('buyer@example.com');
    expect(m.subject).toBe('Premium is active — order CV-7KQ2M9');
    expect(m.text).toContain('until 12 December 2026');
    expect(m.text).toContain('help@x.com');
    expect(m.html).toContain('Your Premium is active');
  });

  it('gives the reason when rejected, escaping it in HTML', () => {
    const m = paymentEmail(order({ status: 'rejected' }), { reason: 'Amount <wrong>' })!;
    expect(m.subject).toBe('About your order CV-7KQ2M9');
    expect(m.text).toContain('Reason: Amount <wrong>');
    expect(m.html).toContain('Amount &lt;wrong&gt;');
  });

  it('sends nothing without a buyer email or for other statuses', () => {
    expect(paymentEmail(order({ email: null }), {})).toBeNull();
    expect(paymentEmail(order({ status: 'pending' }), {})).toBeNull();
  });
});

describe('sendMail', () => {
  it('is skipped, not failed, when the mailbox password is not set', async () => {
    vi.stubEnv('MAIL_OUTBOX', '');
    vi.stubEnv('SMTP_PASSWORD', '');
    vi.stubEnv('SMTP_USER', 'support@aicvstudio.app');
    expect(mailSettings().configured).toBe(false);
    expect(await sendMail(testEmail('a@b.co'))).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('refuses a bad recipient', async () => {
    expect(await sendMail(testEmail('not an email'))).toEqual({
      ok: false,
      reason: 'no_recipient',
    });
  });

  it('defaults to Namecheap Private Email over TLS, from the support mailbox', () => {
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_PORT', '');
    expect(mailSettings('support@aicvstudio.app')).toMatchObject({
      host: 'mail.privateemail.com',
      port: 465,
      from: 'AI CV Studio <support@aicvstudio.app>',
    });
  });
});
