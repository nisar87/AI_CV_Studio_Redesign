'use client';

import { useEffect, useState } from 'react';
import { Copy, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

type Info =
  | { enabled: false }
  | { enabled: true; code: string; joined: number; rewardDays: number; welcomeDays: number };

/** "Invite friends": the person's link, what both sides get, and how many joined. */
export function InviteCard() {
  const toast = useToast();
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    fetch('/api/me/referral', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Info>) : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);
  if (!info?.enabled) return null;
  const link = `${window.location.origin}/r/${info.code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.show({ tone: 'success', message: 'Invite link copied' });
    } catch {
      toast.show({ tone: 'error', message: 'Couldn’t copy. Select the link and copy it.' });
    }
  };
  return (
    <section
      aria-labelledby="invite-h"
      data-testid="invite"
      className="border-line bg-surface shadow-1 flex flex-col gap-3 rounded-lg border p-5"
    >
      <h2 id="invite-h" className="flex items-center gap-2 text-xl font-semibold">
        <Gift aria-hidden size={20} className="text-primary" /> Invite friends
      </h2>
      <p className="text-ink-muted">
        Share your link. When a friend who joins with it buys their first Premium pass, you get{' '}
        <strong>{info.rewardDays} days of Premium</strong>
        {info.welcomeDays > 0 && (
          <>
            {' '}
            and they get <strong>{info.welcomeDays} extra days</strong>
          </>
        )}
        .
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          aria-label="Your invite link"
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="border-line-strong bg-surface min-h-11 min-w-0 flex-1 rounded-md border px-3 text-sm"
        />
        <Button variant="secondary" icon={<Copy aria-hidden size={16} />} onClick={copy}>
          Copy
        </Button>
      </div>
      <p className="text-ink-muted text-sm" data-testid="invite-joined">
        {info.joined === 0
          ? 'No one has joined with your link yet.'
          : info.joined === 1
            ? '1 friend has joined with your link.'
            : `${info.joined} friends have joined with your link.`}
      </p>
    </section>
  );
}
