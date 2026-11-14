'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ExternalLink, Eye, Globe } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useAccount } from '@/features/account/account-context';
import { useEntitlements } from '@/features/account/entitlements';
import { CheckboxField } from '@/features/editor/fields';
import type { PortfolioView } from '@/modules/portfolio/server';
import { slugProblem, suggestSlug } from '@/modules/portfolio/slug';
import { themeForDoc, type Theme } from '@/modules/portfolio/themes';
import { getRepository } from '@/modules/storage/repository';
import { saveDraft, type PortfolioDraft } from './draft';
import { ProjectsEditor, QrCard, SectionsEditor, ThemePicker } from './portfolio-extras';

type Form = PortfolioDraft;
const fromView = (p: PortfolioView): Form => ({
  slug: p.slug,
  docId: p.docId,
  published: p.published,
  showEmail: p.showEmail,
  showPhone: p.showPhone,
  theme: p.theme,
  sections: p.sections,
  projects: p.projects,
  contact: p.contact,
});

export function PortfolioSettings() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted)
    return <div className="skeleton mx-auto my-8 h-80 max-w-[760px] rounded-lg" aria-busy="true" />;
  return <Settings />;
}

function Settings() {
  const account = useAccount();
  const { ent } = useEntitlements();
  const toast = useToast();
  const repo = getRepository();
  const cvs = useMemo(() => repo.list(), [repo]);
  const [saved, setSaved] = useState<PortfolioView | null | undefined>(undefined);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedIn = account.status === 'signedIn';
  const premium = ent?.plan === 'premium';

  useEffect(() => {
    if (!signedIn) return;
    fetch('/api/portfolio', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ portfolio: PortfolioView | null }>)
      .then(({ portfolio }) => {
        setSaved(portfolio);
        const source = cvs.find((c) => c.role === 'profile') ?? cvs[0];
        setForm(
          portfolio
            ? fromView(portfolio)
            : {
                slug: suggestSlug(source?.name ?? ''),
                docId: source?.id ?? '',
                published: true,
                showEmail: false,
                showPhone: false,
                theme: 'auto',
                sections: [],
                projects: [],
                contact: false,
              },
        );
      })
      .catch(() => setSaved(null));
  }, [signedIn, cvs]);

  const url = (slug: string) => `${window.location.origin}/p/${slug}`;
  const problem = form ? slugProblem(form.slug) : null;
  const dirty = !!form && (!saved || JSON.stringify(form) !== JSON.stringify(fromView(saved)));
  const doc = form ? repo.get(form.docId) : null;
  const auto = doc ? themeForDoc(doc) : 'clean';
  const contactOn = !!ent?.features.portfolioContact;

  /** Opens the preview in a new tab with these settings (saved or not). */
  function preview(theme?: Theme) {
    if (!form) return;
    saveDraft(form);
    window.open(`/portfolio-preview${theme ? `?theme=${theme}` : ''}`, '_blank', 'noopener');
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/portfolio', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = (await r.json()) as { portfolio?: PortfolioView; error?: { message: string } };
      if (!r.ok || !j.portfolio) throw new Error(j.error?.message ?? 'That didn’t work.');
      setSaved(j.portfolio);
      setForm(fromView(j.portfolio));
      toast.show({
        tone: 'success',
        message: j.portfolio.published ? 'Your page is live' : 'Saved. Your page is hidden.',
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete your portfolio page? The address will become free for others.')) return;
    await fetch('/api/portfolio', { method: 'DELETE' });
    setSaved(null);
    toast.show({ tone: 'success', message: 'Portfolio page deleted' });
  }

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-8 md:px-8">
      <div>
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight">
          Your portfolio page
        </h1>
        <p className="text-ink-muted mt-1">
          A personal web page made from your CV, in your colours, to put on LinkedIn, your email
          signature or a business card. It updates when you change the CV.
        </p>
      </div>
      {account.status === 'signedOut' ? (
        <Banner
          tone="info"
          title="Sign in to make your portfolio page"
          action={<ButtonLink href="/signin?next=/portfolio">Sign in</ButtonLink>}
        />
      ) : ent && !premium ? (
        <Banner
          tone="info"
          title="Your portfolio page is part of Premium"
          action={<ButtonLink href="/premium?next=/portfolio">See Premium</ButtonLink>}
        >
          Get your own address, like aicvstudio.app/p/your-name, with your CV as a web page.
        </Banner>
      ) : cvs.length === 0 ? (
        <p className="text-ink-muted">
          <Link href="/start" className="text-primary font-semibold">
            Create a CV
          </Link>{' '}
          first, then come back here.
        </p>
      ) : !form || saved === undefined ? (
        <div className="skeleton h-80 rounded-lg" aria-busy="true" aria-label="Loading" />
      ) : (
        <>
          {saved?.published && (
            <Card
              className="flex flex-wrap items-center justify-between gap-3 p-5"
              data-testid="portfolio-live"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  <Globe aria-hidden size={18} className="text-success" /> Your page is live
                </p>
                <a
                  href={url(saved.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary break-all"
                >
                  {url(saved.slug).replace(/^https?:\/\//, '')}
                </a>
                <p className="text-ink-muted text-sm" data-testid="portfolio-views">
                  {saved.views === 1 ? 'Visited once' : `Visited ${saved.views} times`}
                </p>
              </div>
              <ButtonLink
                variant="secondary"
                href={`/p/${saved.slug}`}
                target="_blank"
                icon={<ExternalLink aria-hidden size={16} />}
              >
                Open my page
              </ButtonLink>
              <div className="border-line w-full border-t pt-4">
                <QrCard url={url(saved.slug)} slug={saved.slug} />
              </div>
            </Card>
          )}
          <Card className="flex flex-col gap-4 p-5">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Make it from
              <select
                className="border-line-strong bg-surface min-h-11 rounded-md border px-3 text-[15px] font-normal"
                value={form.docId}
                onChange={(e) => setForm({ ...form, docId: e.target.value })}
              >
                {cvs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.role === 'profile' ? 'Career profile' : c.title || c.name || 'Untitled CV'}
                  </option>
                ))}
              </select>
            </label>
            <ThemePicker
              value={form.theme}
              auto={auto}
              onChange={(theme) => setForm({ ...form, theme })}
              onPreview={(t) => preview(t)}
            />
            <TextField
              label="Your address"
              hint={`aicvstudio.app/p/${form.slug || 'your-name'}`}
              value={form.slug}
              maxLength={40}
              error={form.slug && problem ? problem : undefined}
              onChange={(e) =>
                setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })
              }
            />
            <fieldset className="flex flex-col">
              <legend className="mb-1 text-sm font-semibold">Contact details on the page</legend>
              <CheckboxField
                label="Show my email address"
                checked={form.showEmail}
                onChange={(v) => setForm({ ...form, showEmail: v })}
              />
              <CheckboxField
                label="Show my phone number"
                checked={form.showPhone}
                onChange={(v) => setForm({ ...form, showPhone: v })}
              />
              <p className="text-ink-muted text-xs">
                Your location and links are shown. The page is public, so only show what you’re
                happy for anyone to see.
              </p>
            </fieldset>
            {(contactOn || form.contact) && (
              <div className="flex flex-col">
                <CheckboxField
                  label="Add a contact form"
                  checked={form.contact}
                  onChange={(v) => setForm({ ...form, contact: v })}
                />
                <p className="text-ink-muted -mt-1 pl-8 text-xs">
                  Visitors can send you a message. It comes to your sign-in email
                  {account.user?.email ? ` (${account.user.email})` : ''}; your address stays hidden
                  and replying answers them.
                </p>
              </div>
            )}
          </Card>
          <Card className="flex flex-col gap-6 p-5">
            <SectionsEditor
              value={form.sections}
              onChange={(sections) => setForm({ ...form, sections })}
            />
            <ProjectsEditor
              value={form.projects}
              onChange={(projects) => setForm({ ...form, projects })}
            />
          </Card>
          <Card className="flex flex-col gap-4 p-5">
            <CheckboxField
              label="Page is published"
              checked={form.published}
              onChange={(v) => setForm({ ...form, published: v })}
            />
            {error && (
              <Banner tone="error" title="That didn’t work" onDismiss={() => setError(null)}>
                {error}
              </Banner>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={!dirty || !!problem} loading={busy} onClick={save}>
                {saved ? 'Save changes' : 'Create my page'}
              </Button>
              <Button
                variant="secondary"
                icon={<Eye aria-hidden size={16} />}
                onClick={() => preview()}
              >
                Preview
              </Button>
              {saved && (
                <Button variant="ghost" onClick={remove}>
                  Delete my page
                </Button>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
