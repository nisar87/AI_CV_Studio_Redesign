'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import type { PaymentRequest } from '@/modules/store/types';
import { AdminHeading } from './admin-shell';
import { adminGet, adminSend } from './api';
import { when } from './overview';

type View = 'pending' | 'all';
const STATUS_STYLE: Record<PaymentRequest['status'], string> = {
  pending: 'bg-warning-soft text-ink',
  approved: 'bg-[#e3f1e6] text-[#1f5c2e]',
  rejected: 'bg-sunken text-ink-muted',
  cancelled: 'bg-sunken text-ink-muted',
};

export function AdminPayments() {
  const toast = useToast();
  const [view, setView] = useState<View>('pending');
  const [items, setItems] = useState<PaymentRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    adminGet<{ requests: PaymentRequest[] }>(`/api/admin/payments?status=${view}`).then(
      (r) => setItems(r.requests),
      (e: Error) => setError(e.message),
    );
  }, [view]);
  useEffect(load, [load]);

  const decide = async (r: PaymentRequest, decision: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (decision === 'reject') {
      reason =
        prompt(
          'Why is this payment rejected? The buyer sees this message.',
          'We could not find this payment. Please check the transaction ID and try again.',
        ) ?? undefined;
      if (!reason) return;
    } else if (
      !confirm(
        `Approve ${r.passLabel} (PKR ${r.pricePkr.toLocaleString()}) for ${r.email ?? r.uid}?\nOnly approve after you have seen the money arrive (reference ${r.reference}).`,
      )
    )
      return;
    setBusy(r.id);
    setError(null);
    try {
      const res = await adminSend<{ expiresAt: string | null; emailed?: boolean }>(
        `/api/admin/payments/${r.id}`,
        'POST',
        { decision, reason },
      );
      toast.show({
        tone: 'success',
        message:
          (decision === 'approve'
            ? `Approved — Premium until ${when(res.expiresAt)}`
            : 'Rejected — the buyer will see your message') +
          (res.emailed ? '. The buyer was emailed.' : '. No email was sent (email is not set up).'),
      });
      load();
    } catch (e) {
      setError((e as Error).message);
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <AdminHeading
        title="Payments"
        intro="Check each payment in your bank or wallet app before approving. Approving starts (or extends) Premium straight away."
      />
      <div className="mb-4 max-w-xs">
        <Segmented
          label="Show"
          value={view}
          onChange={(v) => {
            setItems(null);
            setView(v);
          }}
          options={[
            { value: 'pending', label: 'Waiting' },
            { value: 'all', label: 'All recent' },
          ]}
        />
      </div>
      {error && (
        <Banner
          tone="error"
          title="That didn't work"
          className="mb-4"
          onDismiss={() => setError(null)}
        >
          {error}
        </Banner>
      )}
      {!items ? (
        <div className="skeleton h-40 rounded-lg" aria-busy="true" />
      ) : items.length === 0 ? (
        <p className="text-ink-muted border-line bg-surface rounded-lg border p-6 text-center">
          {view === 'pending' ? 'Nothing waiting. New payments appear here.' : 'No payments yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="payments">
          {items.map((r) => (
            <li
              key={r.id}
              className="border-line bg-surface flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4"
              data-testid="payment"
            >
              <div className="min-w-0 text-sm">
                {r.orderNo && (
                  <p className="font-mono text-lg font-bold tracking-wider" data-testid="order-no">
                    {r.orderNo}
                  </p>
                )}
                <p className="text-base font-semibold">
                  {r.email ?? r.uid}
                  <span
                    className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status]}`}
                  >
                    {r.status === 'pending'
                      ? 'Waiting'
                      : r.status === 'approved'
                        ? 'Approved'
                        : r.status === 'cancelled'
                          ? 'Cancelled by buyer'
                          : 'Rejected'}
                  </span>
                </p>
                <p className="mt-1">
                  {r.passLabel} · <strong>PKR {r.pricePkr.toLocaleString()}</strong> ·{' '}
                  {r.methodLabel} · {r.days} days
                </p>
                {(r.couponCode || r.welcomeDays) && (
                  <p className="text-ink-muted mt-0.5" data-testid="payment-extras">
                    {r.couponCode &&
                      `Code ${r.couponCode}${r.listPricePkr && r.listPricePkr !== r.pricePkr ? ` (list price PKR ${r.listPricePkr.toLocaleString()})` : ''}`}
                    {r.couponCode && r.welcomeDays ? ' · ' : ''}
                    {r.welcomeDays ? `Invited by a friend: +${r.welcomeDays} days` : ''}
                  </p>
                )}
                {r.phone && (
                  <p className="mt-0.5">
                    Mobile: <span className="font-mono">{r.phone}</span> ·{' '}
                    <a
                      href={`https://wa.me/${r.phone.replace(/\D/g, '').replace(/^0/, '92')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold"
                    >
                      WhatsApp
                    </a>
                  </p>
                )}
                {r.reference && (
                  <p className="mt-0.5">
                    Transaction ID: <span className="font-mono">{r.reference}</span>
                  </p>
                )}
                {r.note && <p className="text-ink-muted mt-0.5">“{r.note}”</p>}
                <p className="text-ink-muted mt-0.5">
                  Ordered {when(r.createdAt)}
                  {r.decidedAt && ` · ${r.status} ${when(r.decidedAt)} by ${r.decidedBy}`}
                </p>
                {r.reason && <p className="text-ink-muted mt-0.5">Reason: {r.reason}</p>}
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    icon={<Check aria-hidden size={16} />}
                    disabled={busy === r.id}
                    onClick={() => decide(r, 'approve')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<X aria-hidden size={16} />}
                    disabled={busy === r.id}
                    onClick={() => decide(r, 'reject')}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
