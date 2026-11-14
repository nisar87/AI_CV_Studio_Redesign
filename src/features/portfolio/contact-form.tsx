'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextArea, TextField } from '@/components/ui/field';

/**
 * The contact form on a portfolio page (R9.8). The message is emailed to the page's owner, whose
 * address stays hidden; replying to it answers the visitor.
 */
export function ContactForm({
  slug,
  name,
  preview = false,
}: {
  slug: string;
  name: string;
  preview?: boolean;
}) {
  const [from, setFrom] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const first = name.split(/\s+/)[0] || 'them';

  if (sent)
    return (
      <p
        role="status"
        className="bg-success-soft text-success rounded-lg p-4 font-semibold"
        data-testid="contact-sent"
      >
        Thank you, your message is on its way. {first} will reply to {email}.
      </p>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) {
      setError('This is a preview. Visitors can send you a message here once the page is live.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/p/${encodeURIComponent(slug)}/contact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: from, email, message, website }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: { message: string } } | null;
        setError(j?.error?.message ?? 'Your message wasn’t sent. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('You seem to be offline. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-[560px] flex-col gap-4"
      data-testid="contact-form"
    >
      <p className="text-ink-muted">Send {first} a message. They’ll reply by email.</p>
      <TextField
        label="Your name"
        value={from}
        maxLength={80}
        autoComplete="name"
        onChange={(e) => setFrom(e.target.value)}
      />
      <TextField
        label="Your email"
        type="email"
        value={email}
        maxLength={200}
        autoComplete="email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextArea
        label="Message"
        value={message}
        maxLength={2000}
        rows={5}
        onChange={(e) => setMessage(e.target.value)}
      />
      {/* For robots only: hidden from people and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <Banner tone="error" title="Not sent" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      <Button
        type="submit"
        loading={busy}
        disabled={busy || !from.trim() || !email.trim() || !message.trim()}
        icon={<Send aria-hidden size={16} />}
        className="self-start"
      >
        Send message
      </Button>
    </form>
  );
}
