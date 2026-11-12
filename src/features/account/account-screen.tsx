'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CircleCheck, LogOut, MailWarning } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAccount } from './account-context';
import { useEntitlements } from './entitlements';
import { TextField } from '@/components/ui/field';
import {
  AuthUiError,
  authMessage,
  refreshVerification,
  resendVerification,
} from './firebase-client';

export function AccountScreen() {
  const account = useAccount();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const { ent } = useEntitlements();
  // Signing out on purpose goes home, not to the sign-in page.
  const leaving = useRef(false);

  useEffect(() => {
    if (account.status === 'signedOut' && !leaving.current) router.replace('/signin?next=/account');
  }, [account.status, router]);

  if (account.status !== 'signedIn' || !account.user) {
    return (
      <div
        className="skeleton h-48 rounded-lg"
        aria-busy="true"
        aria-label="Loading your account"
      />
    );
  }
  const u = account.user;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.show({ tone: 'error', message: authMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section
        className="border-line bg-surface shadow-1 flex flex-col gap-4 rounded-lg border p-5"
        aria-labelledby="acc-h"
      >
        <h2 id="acc-h" className="text-xl font-semibold">
          Your account
        </h2>
        <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          {u.name && (
            <>
              <dt className="text-ink-muted">Name</dt>
              <dd className="font-semibold">{u.name}</dd>
            </>
          )}
          <dt className="text-ink-muted">Email</dt>
          <dd className="flex flex-wrap items-center gap-2 font-semibold">
            {u.email}
            {u.emailVerified ? (
              <span className="text-success inline-flex items-center gap-1 text-sm font-semibold">
                <CircleCheck aria-hidden size={16} /> Verified
              </span>
            ) : (
              <span className="text-warning inline-flex items-center gap-1 text-sm font-semibold">
                <MailWarning aria-hidden size={16} /> Not verified yet
              </span>
            )}
          </dd>
          <dt className="text-ink-muted">Your CVs</dt>
          <dd>
            Saved to your account and available wherever you sign in.{' '}
            {account.sync === 'syncing' && <span className="text-ink-muted">Saving…</span>}
            {account.sync === 'offline' && (
              <span className="text-warning">
                Offline — changes will save when you are back online.
              </span>
            )}
            {account.sync === 'error' && (
              <span className="text-danger">
                Some changes could not be saved yet. We will keep trying.
              </span>
            )}
          </dd>
        </dl>
        {!u.emailVerified && (
          <Banner tone="warning" title="Please verify your email">
            <p>
              We sent a link to {u.email}. Verifying lets us reach you about payments and keeps your
              account safe.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={busy === 'resend'}
                onClick={() =>
                  void run('resend', async () => {
                    await resendVerification();
                    toast.show({ tone: 'success', message: 'Verification email sent.' });
                  })
                }
              >
                Send the link again
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={busy === 'check'}
                onClick={() =>
                  void run('check', async () => {
                    const ok = await refreshVerification();
                    await account.refresh();
                    toast.show({
                      tone: ok ? 'success' : 'neutral',
                      message: ok
                        ? 'Thanks — your email is verified.'
                        : 'Not verified yet. Open the link in the email first.',
                    });
                  })
                }
              >
                I have verified it
              </Button>
            </div>
          </Banner>
        )}
      </section>

      {ent && ent.plan !== 'visitor' && (
        <section
          aria-labelledby="plan-h"
          data-testid="plan"
          className="border-line bg-surface shadow-1 flex flex-col gap-4 rounded-lg border p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="plan-h" className="text-xl font-semibold">
              Your plan: {ent.planLabel}
            </h2>
            {ent.plan === 'premium' && ent.passExpiresAt && (
              <p className="text-ink-muted text-sm">
                Premium until{' '}
                {new Date(ent.passExpiresAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
          <dl className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ['pdf.download', 'PDF downloads'],
                ['import.cv', 'CV imports'],
                ['ai.action', 'AI actions'],
              ] as const
            ).map(([k, label]) => {
              const lim = ent.limits[k];
              return (
                <div key={k} className="bg-sunken rounded-md px-3 py-2">
                  <dt className="text-ink-muted text-sm">{label} this month</dt>
                  <dd className="font-semibold">
                    {lim === 0
                      ? 'Premium only'
                      : lim === -1
                        ? `${ent.usage[k]} used`
                        : `${ent.usage[k]} of ${lim}`}
                  </dd>
                </div>
              );
            })}
          </dl>
          {ent.plan !== 'premium' && ent.features.sales && ent.passes.length > 0 && (
            <ButtonLink href="/premium" className="self-start">
              See Premium
            </ButtonLink>
          )}
        </section>
      )}

      <section className="flex flex-wrap gap-3" aria-label="Account actions">
        <ButtonLink href="/cv" variant="secondary">
          My CVs
        </ButtonLink>
        <Button
          variant="ghost"
          icon={<LogOut aria-hidden size={18} />}
          loading={busy === 'out'}
          onClick={() =>
            void run('out', async () => {
              leaving.current = true;
              await account.signOut();
              router.replace('/');
            })
          }
        >
          Sign out
        </Button>
        <Button
          variant="ghost"
          loading={busy === 'all'}
          onClick={() =>
            void run('all', async () => {
              leaving.current = true;
              await account.signOut(true);
              router.replace('/');
            })
          }
        >
          Sign out on all devices
        </Button>
      </section>
      <p className="text-ink-muted text-sm">
        Signing out removes your account’s CVs from this device. They stay safe in your account.
      </p>

      {!u.admin && (
        <section aria-labelledby="del-h" className="border-line flex flex-col gap-3 border-t pt-6">
          <h2 id="del-h" className="text-lg font-semibold">
            Delete your account
          </h2>
          <p className="text-ink-muted text-sm">
            This permanently deletes your account and every CV in it, including earlier versions. It
            can’t be undone — download any CV you want to keep first.
          </p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run('delete', async () => {
                const r = await fetch('/api/me', {
                  method: 'DELETE',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ confirm }),
                });
                if (!r.ok) {
                  const j = (await r.json().catch(() => null)) as {
                    error?: { message?: string };
                  } | null;
                  throw new AuthUiError(j?.error?.message ?? 'That didn’t work. Please try again.');
                }
                leaving.current = true;
                await account.signOut();
                toast.show({ tone: 'success', message: 'Your account has been deleted.' });
                router.replace('/');
              });
            }}
          >
            <TextField
              label="Type DELETE to confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              containerClassName="w-56"
            />
            <Button
              type="submit"
              variant="danger"
              disabled={confirm !== 'DELETE'}
              loading={busy === 'delete'}
            >
              Delete my account
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
