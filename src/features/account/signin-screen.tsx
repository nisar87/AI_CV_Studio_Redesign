'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Check, Circle } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { CheckboxField } from '@/features/editor/fields';
import { useAccount } from './account-context';
import {
  authMessage,
  PASSWORD_RULES,
  sendReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from './firebase-client';

type Mode = 'signin' | 'signup' | 'reset';

function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/cv';
}

function GoogleMark() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export function SignInScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const account = useAccount();
  const next = safeNext(params.get('next'));
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const rulesOk = PASSWORD_RULES.every((r) => r.test(password));
  const done = async () => {
    await account.refresh();
    router.replace(next);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (mode === 'reset') {
      setBusy('email');
      try {
        await sendReset(email);
        setNotice(
          'If an account exists for this email, we have sent a link to reset your password.',
        );
      } catch (err) {
        setError(authMessage(err));
      } finally {
        setBusy(null);
      }
      return;
    }
    if (mode === 'signup') {
      if (!rulesOk) return setError('Please choose a password that meets all the requirements.');
      if (password !== confirm) return setError('The two passwords don’t match.');
      if (!adult) return setError('Please confirm you are 18 or older to create an account.');
    }
    setBusy('email');
    try {
      if (mode === 'signup') await signUpWithEmail(email, password);
      else await signInWithEmail(email, password);
      await done();
    } catch (err) {
      setError(authMessage(err));
      setBusy(null);
    }
  }

  async function google() {
    setError('');
    setBusy('google');
    try {
      await signInWithGoogle();
      await done();
    } catch (err) {
      setError(authMessage(err));
      setBusy(null);
    }
  }

  const title =
    mode === 'signin'
      ? 'Sign in'
      : mode === 'signup'
        ? 'Create your account'
        : 'Reset your password';
  const intro =
    mode === 'signin'
      ? 'Welcome back. Your CVs are saved to your account and available on every device.'
      : mode === 'signup'
        ? 'Save your CVs to your account, use them on any device, and download them as PDFs.'
        : 'Enter the email you use for AI CV Studio and we will send you a reset link.';

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-ink-muted">{intro}</p>
      </div>

      {error && (
        <p role="alert" className="text-danger bg-danger-soft rounded-md px-3 py-2 text-[15px]">
          {error}
        </p>
      )}
      {notice && <Banner tone="success">{notice}</Banner>}

      {mode !== 'reset' && (
        <>
          <Button
            variant="secondary"
            size="lg"
            icon={<GoogleMark />}
            loading={busy === 'google'}
            loadingText="Opening Google…"
            disabled={busy !== null}
            onClick={() => void google()}
          >
            Continue with Google
          </Button>
          <div className="text-ink-subtle flex items-center gap-3 text-sm">
            <span className="bg-line h-px flex-1" /> or with email{' '}
            <span className="bg-line h-px flex-1" />
          </div>
        </>
      )}

      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== 'reset' && (
          <TextField
            label="Password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {mode === 'signup' && (
          <>
            <ul className="grid gap-1 text-sm" aria-label="Password requirements">
              {PASSWORD_RULES.map((r) => {
                const ok = r.test(password);
                return (
                  <li
                    key={r.id}
                    className={cn(
                      'flex items-center gap-2',
                      ok ? 'text-success' : 'text-ink-muted',
                    )}
                  >
                    {ok ? (
                      <Check aria-hidden size={14} />
                    ) : (
                      <Circle aria-hidden size={10} className="mx-0.5" />
                    )}
                    {r.label}
                    <span className="sr-only">{ok ? '(done)' : '(not yet)'}</span>
                  </li>
                );
              })}
            </ul>
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={confirm && confirm !== password ? 'The passwords don’t match' : undefined}
            />
            <CheckboxField
              label="I am 18 or older and agree to the terms and privacy notice"
              checked={adult}
              onChange={setAdult}
            />
          </>
        )}
        <Button type="submit" size="lg" loading={busy === 'email'} disabled={busy !== null}>
          {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </Button>
      </form>

      <div className="text-ink-muted flex flex-col gap-2 text-[15px]">
        {mode === 'signin' && (
          <>
            <button
              type="button"
              className="text-primary self-start font-semibold"
              onClick={() => setMode('reset')}
            >
              Forgot your password?
            </button>
            <p>
              New here?{' '}
              <button
                type="button"
                className="text-primary font-semibold"
                onClick={() => setMode('signup')}
              >
                Create an account
              </button>
            </p>
          </>
        )}
        {mode !== 'signin' && (
          <p>
            {mode === 'signup' ? 'Already have an account? ' : ''}
            <button
              type="button"
              className="text-primary font-semibold"
              onClick={() => setMode('signin')}
            >
              {mode === 'signup' ? 'Sign in' : 'Back to sign in'}
            </button>
          </p>
        )}
        <p className="text-sm">
          By continuing you confirm you are 18 or older and agree to our{' '}
          <Link href="/terms" className="text-primary underline underline-offset-4">
            terms
          </Link>
          . Read our{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-4">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
