'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Clock, Copy, MessageCircle, Minus, ShieldCheck, Sparkles } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, SelectableCard } from '@/components/ui/card';
import { TextArea, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useAccount } from '@/features/account/account-context';
import type { Quote } from '@/modules/billing/coupons';
import type { PremiumOffer } from '@/modules/billing/premium';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' });
const pkr = (n: number) => `PKR ${n.toLocaleString()}`;
const perMonth = (price: number, days: number) => Math.round((price / days) * 30);

function limitText(n: number, unit: string) {
  if (n === -1) return 'Unlimited';
  if (n === 0) return null;
  return `${n.toLocaleString()} ${unit} a month`;
}

export function PremiumScreen() {
  const account = useAccount();
  const toast = useToast();
  const [offer, setOffer] = useState<PremiumOffer | null>(null);
  const [passId, setPassId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Discount code and the server's price for this person (coupon / invite bonus applied).
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  const load = useCallback(() => {
    fetch('/api/premium', { cache: 'no-store' })
      .then((r) => r.json() as Promise<PremiumOffer>)
      .then((o) => {
        setOffer(o);
        setPassId((cur) => cur ?? o.passes[o.passes.length > 1 ? 1 : 0]?.id ?? null);
        setMethodId((cur) => cur ?? o.methods[0]?.id ?? null);
      })
      .catch(() => setError('We couldn’t load Premium options. Please reload the page.'));
  }, []);
  const accountKey = `${account.status}:${account.user?.uid ?? ''}`;
  useEffect(() => {
    if (!accountKey.startsWith('loading')) load();
  }, [accountKey, load]);

  const signedIn = !!offer?.me;
  useEffect(() => {
    if (!signedIn || !passId) return;
    let live = true;
    fetch('/api/premium/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passId, code: code || undefined }),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as {
          quote?: Quote;
          error?: { message?: string };
        } | null;
        if (!live) return;
        if (r.ok && j?.quote) {
          setQuote(j.quote);
          if (code) setCodeError(null);
        } else if (code) {
          setCodeError(j?.error?.message ?? 'That code can’t be used.');
          setCode('');
        } else setQuote(null);
      })
      .catch(() => live && setQuote(null));
    return () => {
      live = false;
    };
  }, [signedIn, passId, code]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passId || !methodId) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch('/api/premium/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          passId,
          methodId,
          phone,
          reference: reference || undefined,
          note: note || undefined,
          code: code || undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? 'That didn’t work. Please try again.');
      }
      toast.show({ tone: 'success', message: 'Thank you! We’re checking your payment.' });
      setReference('');
      setPhone('');
      setNote('');
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!offer)
    return error ? (
      <Banner tone="error" title={error} />
    ) : (
      <div className="skeleton h-96 rounded-lg" aria-busy="true" aria-label="Loading" />
    );

  const { plans, designs, me } = offer;
  const isPremium = me?.plan === 'premium';
  const latest = me?.requests[0];
  const pending = me?.requests.find((r) => r.status === 'pending');
  const pass = offer.passes.find((p) => p.id === passId);
  const method = offer.methods.find((m) => m.id === methodId);
  const q = quote && quote.passId === passId ? quote : null;
  const amount = q?.pricePkr ?? pass?.pricePkr ?? 0;
  const best =
    offer.passes.length > 1
      ? offer.passes.reduce((a, b) => (b.pricePkr / b.days < a.pricePkr / a.days ? b : a))
      : null;

  const rows: { label: string; free: string | null; premium: string | null }[] = [
    {
      label: 'CV designs',
      free: designs.free === designs.total ? `All ${designs.total}` : `${designs.free} designs`,
      premium: `All ${designs.total} designs`,
    },
    {
      label: 'PDF downloads',
      free: limitText(plans.free.limits['pdf.download'], 'downloads'),
      premium: limitText(plans.premium.limits['pdf.download'], 'downloads'),
    },
    {
      label: 'AI writing help',
      free: limitText(plans.free.limits['ai.action'], 'actions'),
      premium: offer.aiAvailable
        ? limitText(plans.premium.limits['ai.action'], 'actions')
        : 'Coming soon',
    },
    {
      label: 'Import an existing CV',
      free: limitText(plans.free.limits['import.cv'], 'imports'),
      premium: limitText(plans.premium.limits['import.cv'], 'imports'),
    },
    { label: 'Saved in your account, on every device', free: 'Yes', premium: 'Yes' },
  ];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="text-primary flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
          <Sparkles aria-hidden size={16} /> Premium
        </p>
        <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight sm:text-5xl">
          Every design, more downloads and AI help
        </h1>
        <p className="text-ink-muted max-w-2xl text-lg">
          A one-time pass. It doesn’t renew by itself, so you only pay again if you choose to. Your
          CVs stay yours whatever you decide.
        </p>
      </header>

      {isPremium && me?.passExpiresAt && (
        <Banner tone="success" title={`You have Premium until ${fmtDate(me.passExpiresAt)}.`}>
          Buying another pass adds its days to the end of this one.
        </Banner>
      )}

      <section aria-labelledby="compare">
        <h2 id="compare" className="sr-only">
          Free and Premium compared
        </h2>
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm sm:text-[15px] [&_td]:p-3 sm:[&_td]:p-4 [&_th]:p-3 sm:[&_th]:p-4">
            <thead>
              <tr className="border-line border-b">
                <th className="font-semibold" scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="w-[26%] font-semibold" scope="col">
                  {plans.free.label}
                </th>
                <th className="bg-primary-soft text-primary w-[34%] font-semibold" scope="col">
                  {plans.premium.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-line border-b last:border-0">
                  <th scope="row" className="font-normal">
                    {r.label}
                  </th>
                  <td className="text-ink-muted">
                    {r.free ?? (
                      <>
                        <Minus aria-hidden size={18} />
                        <span className="sr-only">Not included</span>
                      </>
                    )}
                  </td>
                  <td className="bg-primary-soft/50 font-semibold">
                    {r.premium ? (
                      <span className="flex items-center gap-2">
                        <Check
                          aria-hidden
                          size={18}
                          className="text-primary hidden shrink-0 sm:block"
                        />
                        {r.premium}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {!offer.sales ? (
        <Card className="flex flex-col items-start gap-2 p-6">
          <h2 className="text-xl font-semibold">Premium opens soon</h2>
          <p className="text-ink-muted">
            Everything else in the studio is ready to use now. Check back soon to get Premium.
          </p>
        </Card>
      ) : (
        <>
          <section aria-labelledby="step-pass" className="flex flex-col gap-4">
            <h2 id="step-pass" className="text-2xl font-semibold">
              <span className="text-ink-subtle mr-2">1</span>Choose your pass
            </h2>
            <div
              role="radiogroup"
              aria-labelledby="step-pass"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {offer.passes.map((p) => (
                <SelectableCard
                  key={p.id}
                  role="radio"
                  aria-checked={p.id === passId}
                  selected={p.id === passId}
                  onClick={() => setPassId(p.id)}
                >
                  {best?.id === p.id && (
                    <span className="bg-primary text-on-primary mb-1 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                      Best value
                    </span>
                  )}
                  <span className="text-lg font-semibold">{p.label}</span>
                  <span className="font-display text-3xl font-semibold">{pkr(p.pricePkr)}</span>
                  <span className="text-ink-muted text-sm">
                    {p.days} days of Premium
                    {p.days >= 60 && ` · about ${pkr(perMonth(p.pricePkr, p.days))} a month`}
                  </span>
                </SelectableCard>
              ))}
            </div>
          </section>

          {!me ? (
            <Card className="flex flex-col items-start gap-3 p-6">
              <h2 className="text-xl font-semibold">Sign in to continue</h2>
              <p className="text-ink-muted">
                Premium belongs to your account, so it works on every device you sign in on.
              </p>
              <ButtonLink href="/signin?next=/premium">Sign in or create an account</ButtonLink>
            </Card>
          ) : pending ? (
            <PendingOrder pending={pending} whatsapp={offer.whatsapp} />
          ) : (
            <>
              <section aria-labelledby="step-pay" className="flex flex-col gap-4">
                <h2 id="step-pay" className="text-2xl font-semibold">
                  <span className="text-ink-subtle mr-2">2</span>Pay {pass ? pkr(amount) : ''}
                </h2>
                <div className="flex max-w-xl flex-col gap-2" data-testid="coupon">
                  {code && q?.couponCode ? (
                    <p
                      className="text-success flex flex-wrap items-center gap-2 font-semibold"
                      role="status"
                    >
                      <Check aria-hidden size={18} /> Code {q.couponCode} applied
                      {q.pricePkr < q.listPricePkr && ` — ${pkr(q.listPricePkr - q.pricePkr)} off`}
                      {q.days > (pass?.days ?? 0) + q.welcomeDays &&
                        ` — ${q.days - (pass?.days ?? 0) - q.welcomeDays} extra days`}
                      <button
                        type="button"
                        className="text-ink-muted text-sm font-normal underline"
                        onClick={() => {
                          setCode('');
                          setCodeInput('');
                        }}
                      >
                        Remove
                      </button>
                    </p>
                  ) : (
                    <form
                      className="flex items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (codeInput.trim()) setCode(codeInput.trim().toUpperCase());
                      }}
                    >
                      <TextField
                        label="Discount code"
                        optional
                        value={codeInput}
                        maxLength={20}
                        autoComplete="off"
                        error={codeError ?? undefined}
                        onChange={(e) => {
                          setCodeInput(e.target.value);
                          setCodeError(null);
                        }}
                        containerClassName="flex-1"
                      />
                      <Button type="submit" variant="secondary" disabled={!codeInput.trim()}>
                        Apply
                      </Button>
                    </form>
                  )}
                  {q && q.welcomeDays > 0 && (
                    <p className="text-success text-sm font-semibold" role="status">
                      A friend invited you: you get {q.welcomeDays} extra days ({q.days} days in
                      total).
                    </p>
                  )}
                </div>
                {offer.methods.length > 1 && (
                  <div
                    role="radiogroup"
                    aria-label="Payment method"
                    className="flex flex-wrap gap-2"
                  >
                    {offer.methods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={m.id === methodId}
                        onClick={() => setMethodId(m.id)}
                        className={
                          m.id === methodId
                            ? 'border-primary bg-primary-soft text-primary min-h-11 rounded-full border-2 px-4 font-semibold'
                            : 'border-line-strong bg-surface hover:bg-sunken min-h-11 rounded-full border px-4 font-semibold'
                        }
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
                {method && pass && (
                  <Card className="flex flex-col gap-1 p-5" data-testid="payment-details">
                    <p className="text-ink-muted text-sm font-semibold">{method.label}</p>
                    <CopyLine label="Amount" value={String(amount)} shown={pkr(amount)} />
                    {method.details
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((line, i) => {
                        const at = line.indexOf(':');
                        return at > 0 ? (
                          <CopyLine
                            key={i}
                            label={line.slice(0, at).trim()}
                            value={line.slice(at + 1).trim()}
                          />
                        ) : (
                          <CopyLine key={i} value={line} />
                        );
                      })}
                  </Card>
                )}
                {offer.instructions && (
                  <p className="text-ink-muted max-w-2xl">{offer.instructions}</p>
                )}
              </section>

              <section aria-labelledby="step-confirm" className="flex flex-col gap-4">
                <h2 id="step-confirm" className="text-2xl font-semibold">
                  <span className="text-ink-subtle mr-2">3</span>Place your order
                </h2>
                <p className="text-ink-muted -mt-2 max-w-xl">
                  You’ll get an order number. Send a screenshot of your payment with it
                  {offer.whatsapp ? ' on WhatsApp' : ''}, and Premium starts as soon as we’ve
                  checked it.
                </p>
                {latest?.status === 'rejected' && (
                  <Banner tone="error" title="Your last payment wasn’t approved">
                    {latest.reason}
                  </Banner>
                )}
                <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
                  <TextField
                    label="Your mobile number"
                    hint="So we can match your payment and reach you if needed."
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    maxLength={20}
                    placeholder="0300 1234567"
                  />
                  <TextField
                    label="Transaction ID"
                    optional
                    hint="If it’s easy to copy from your receipt. The screenshot is enough."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={60}
                    autoComplete="off"
                  />
                  <TextArea
                    label="Anything we should know?"
                    optional
                    rows={2}
                    maxLength={300}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {error && (
                    <p role="alert" className="text-danger text-sm">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    loading={sending}
                    className="self-start"
                    disabled={!pass || !method}
                  >
                    Place order · {pass ? pkr(amount) : ''}
                  </Button>
                </form>
              </section>
            </>
          )}
        </>
      )}

      <section aria-labelledby="faq" className="border-line flex flex-col gap-4 border-t pt-8">
        <h2 id="faq" className="flex items-center gap-2 text-xl font-semibold">
          <ShieldCheck aria-hidden size={20} className="text-primary" /> Good to know
        </h2>
        <dl className="grid gap-5 sm:grid-cols-2">
          <Faq q="Is this a subscription?">
            No. A pass lasts for its number of days and then simply ends. Nothing is charged
            automatically.
          </Faq>
          <Faq q="What happens when it ends?">
            Your CVs stay in your account. CVs in a Premium design can be switched to a free design
            in one click, with all your words kept.
          </Faq>
          <Faq q="How long does checking take?">
            We check payments by hand, usually within a day. You’ll see Premium on your account as
            soon as it’s approved.
            {offer.supportEmail && (
              <>
                {' '}
                Questions about a payment? Email{' '}
                <a href={`mailto:${offer.supportEmail}`} className="text-primary font-semibold">
                  {offer.supportEmail}
                </a>{' '}
                with your order number.
              </>
            )}
          </Faq>
          <Faq q="Does the AI make things up?">
            No. It only rewords what you wrote. Where a number or fact is missing, it asks you
            instead of inventing one.
          </Faq>
        </dl>
      </section>
    </div>
  );
}

function CopyLine({ label, value, shown }: { label?: string; value: string; shown?: string }) {
  const toast = useToast();
  return (
    <div className="border-line flex items-center justify-between gap-3 border-b py-2 last:border-0">
      <div className="min-w-0">
        {label && <p className="text-ink-muted text-xs">{label}</p>}
        <p className="font-mono text-[15px] break-all">{shown ?? value}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        icon={<Copy aria-hidden size={16} />}
        aria-label={`Copy ${label ?? value}`}
        onClick={() =>
          navigator.clipboard
            .writeText(value)
            .then(() => toast.show({ tone: 'success', message: 'Copied' }))
            .catch(() =>
              toast.show({ tone: 'error', message: 'Couldn’t copy — please select it instead.' }),
            )
        }
      >
        Copy
      </Button>
    </div>
  );
}

/** The waiting state: the order number and how to send the payment screenshot. */
function PendingOrder({
  pending,
  whatsapp,
}: {
  pending: NonNullable<PremiumOffer['me']>['requests'][number];
  whatsapp: string;
}) {
  const toast = useToast();
  const order = pending.orderNo ?? pending.reference;
  const message = `Order ${order}: ${pending.passLabel}, ${pkr(pending.pricePkr)} by ${pending.methodLabel}. Payment screenshot attached.`;
  const wa = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '').replace(/^0/, '92')}?text=${encodeURIComponent(message)}`
    : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(order);
      toast.show({ tone: 'success', message: 'Order number copied' });
    } catch {
      toast.show({ tone: 'error', message: 'Couldn’t copy. Write the order number down.' });
    }
  };
  return (
    <Card className="flex flex-col gap-4 p-6" data-testid="premium-pending" role="status">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Clock aria-hidden size={20} className="text-primary" /> Your order is waiting for payment
        check
      </h2>
      <div className="bg-sunken flex flex-wrap items-center justify-between gap-3 rounded-md p-4">
        <div>
          <p className="text-ink-muted text-sm">Order number</p>
          <p className="font-mono text-2xl font-bold tracking-wider" data-testid="order-no">
            {order}
          </p>
        </div>
        {pending.orderNo && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy aria-hidden size={16} />}
            onClick={copy}
          >
            Copy
          </Button>
        )}
      </div>
      <p className="text-ink-muted">
        {pending.passLabel} · {pkr(pending.pricePkr)} by {pending.methodLabel} · placed{' '}
        {fmtDate(pending.createdAt)}.
      </p>
      {pending.orderNo && (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">
            Now send a screenshot of your payment with this order number
            {whatsapp ? ' on WhatsApp' : ''}.
          </p>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-md bg-[#1f7a4d] px-4 font-semibold text-white hover:bg-[#186640]"
            >
              <MessageCircle aria-hidden size={18} /> Send on WhatsApp
            </a>
          )}
          {whatsapp && (
            <p className="text-ink-muted text-sm">
              Or send it to <span className="font-semibold whitespace-nowrap">{whatsapp}</span> with
              your order number.
            </p>
          )}
        </div>
      )}
      <p className="text-ink-muted text-sm">
        We check payments by hand, usually within a day. Premium starts as soon as it’s approved;
        this page updates by itself when you come back.
      </p>
    </Card>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{q}</dt>
      <dd className="text-ink-muted mt-1">{children}</dd>
    </div>
  );
}
