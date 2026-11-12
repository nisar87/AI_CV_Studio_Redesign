'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { ArrowRight, Check, FileUp, Lock, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAccount } from '@/features/account/account-context';
import { remaining, useEntitlements } from '@/features/account/entitlements';
import { DocumentPreview } from '@/features/preview/document-preview';
import type { ImportReport } from '@/modules/import/parse';
import type { ResumeDocument, TemplateId } from '@/modules/resume/schema';
import { getRepository } from '@/modules/storage/repository';
import { getTemplate, TEMPLATE_LIST } from '@/modules/templates/registry';

type Result = { document: ResumeDocument; report: ImportReport; method?: 'ai' | 'rules' };
const ACCEPT =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const KIND_LABEL: Record<string, string> = {
  experience: 'jobs',
  volunteering: 'volunteering roles',
  education: 'qualifications',
  skills: 'skill groups',
  languages: 'languages',
  certifications: 'certificates',
  licences: 'licences',
  awards: 'awards',
  projects: 'projects',
};

export function ImportScreen() {
  const router = useRouter();
  const account = useAccount();
  const { ent, refresh } = useEntitlements();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId | null>(null);

  const designs = useMemo(() => {
    const cat = new Map((ent?.designs ?? []).map((d) => [d.id, d]));
    return TEMPLATE_LIST.filter((t) => cat.get(t.id)?.enabled !== false).map((t) => ({
      t,
      premium: cat.get(t.id)?.tier === 'premium',
    }));
  }, [ent]);
  const isPremium = ent?.plan === 'premium';
  const firstFree = designs.find((d) => !d.premium)?.t.id ?? 'clarity';
  const chosen = templateId ?? firstFree;

  const preview = useMemo(() => {
    if (!result) return null;
    const t = getTemplate(chosen);
    return {
      ...result.document,
      design: {
        ...result.document.design,
        templateId: chosen,
        fontPair: t.support.defaults.fontPair ?? result.document.design.fontPair,
      },
    } satisfies ResumeDocument;
  }, [result, chosen]);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      if (!/\.(pdf|docx)$/i.test(file.name)) {
        setError(
          /\.doc$/i.test(file.name)
            ? 'This is an older Word file (.doc). Open it in Word and use “Save as” → .docx or PDF, then try again.'
            : 'Please choose a PDF or a Word (.docx) file.',
        );
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('That file is larger than 5 MB. Please choose a smaller file.');
        return;
      }
      setBusy(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const region = (navigator.language || '').split('-')[1]?.toUpperCase();
        form.append('locale', `en-${region && /^[A-Z]{2}$/.test(region) ? region : 'GB'}`);
        const r = await fetch('/api/import', { method: 'POST', body: form });
        const j = (await r.json().catch(() => null)) as
          (Result & { error?: undefined }) | { error: { message: string } } | null;
        if (!r.ok || !j || j.error)
          throw new Error(j?.error?.message ?? 'That didn’t work. Please try again.');
        setResult(j as Result);
        refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && !busy) void upload(f);
  };

  const open = () => {
    if (!preview) return;
    const now = new Date().toISOString();
    getRepository().save({ ...preview, createdAt: now, updatedAt: now });
    router.push(`/cv/${preview.id}`);
  };

  // ---------- gates ----------
  if (account.status === 'loading' || !ent)
    return <div className="skeleton h-72 rounded-lg" aria-busy="true" aria-label="Loading" />;

  if (!ent.features.import)
    return (
      <Banner tone="info" title="Importing is switched off right now. Please try again later." />
    );

  if (account.status === 'signedOut')
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <Lock aria-hidden className="text-primary" />
        <h2 className="text-xl font-semibold">Sign in to import your CV</h2>
        <p className="text-ink-muted">
          Importing is part of your free account. Your CV is then saved to your account, so it’s on
          every device you use.
        </p>
        <ButtonLink href="/signin?next=/cv/import">Sign in or create a free account</ButtonLink>
      </Card>
    );

  const left = remaining(ent, 'import.cv');
  const limit = ent.limits['import.cv'];

  // ---------- result ----------
  if (result && preview) {
    const r = result.report;
    const found = [
      r.name && 'your name',
      (r.email || r.phone) && 'contact details',
      r.summary && 'a profile',
    ].filter(Boolean) as string[];
    const chosenPremium = designs.find((d) => d.t.id === chosen)?.premium;
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-6">
          <div>
            <h2
              className="flex items-center gap-2 text-2xl font-semibold"
              data-testid="import-done"
            >
              <Check aria-hidden className="text-primary" /> We’ve read your CV
            </h2>
            {result.method === 'ai' && (
              <p
                className="text-primary mt-1 flex items-center gap-1.5 text-sm font-semibold"
                data-testid="import-method"
              >
                <Sparkles aria-hidden size={16} /> Sorted by AI, then checked word by word against
                your file — nothing was added.
              </p>
            )}
            <p className="text-ink-muted mt-1">
              Everything is now in editable fields. Have a quick look — layouts vary, so check each
              section before you send it.
            </p>
          </div>
          <Card className="p-5" data-testid="import-report">
            <h3 className="mb-2 font-semibold">What we found</h3>
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {found.length > 0 && (
                <li className="flex gap-2">
                  <Check aria-hidden size={18} className="text-primary mt-0.5 shrink-0" />
                  {cap(listJoin(found))}
                </li>
              )}
              {r.sections
                .filter((s) => s.kind !== 'custom')
                .map((s) => (
                  <li key={s.title} className="flex gap-2">
                    <Check aria-hidden size={18} className="text-primary mt-0.5 shrink-0" />
                    {s.title}: {s.items}{' '}
                    {s.items === 1 ? KIND_LABEL[s.kind]?.replace(/s$/, '') : KIND_LABEL[s.kind]}
                  </li>
                ))}
              {r.sections
                .filter((s) => s.kind === 'custom')
                .map((s) => (
                  <li key={s.title} className="flex gap-2">
                    <Check aria-hidden size={18} className="text-primary mt-0.5 shrink-0" />
                    {s.title}
                  </li>
                ))}
              {!r.name && (
                <li className="text-warning flex gap-2">
                  <TriangleAlert aria-hidden size={18} className="mt-0.5 shrink-0" /> We couldn’t
                  find your name — add it at the top.
                </li>
              )}
              {r.unplaced > 0 && (
                <li className="flex gap-2">
                  <TriangleAlert aria-hidden size={18} className="text-warning mt-0.5 shrink-0" />
                  {r.unplaced} line{r.unplaced === 1 ? '' : 's'} we weren’t sure about are kept in
                  “Other” for you to move or delete.
                </li>
              )}
            </ul>
          </Card>

          <div className="flex flex-col gap-3">
            <h3 className="font-semibold" id="pick-design">
              Choose a design
            </h3>
            <div role="radiogroup" aria-labelledby="pick-design" className="flex flex-wrap gap-2">
              {designs.map(({ t, premium }) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={t.id === chosen}
                  onClick={() => setTemplateId(t.id)}
                  className={
                    t.id === chosen
                      ? 'border-primary bg-primary-soft text-primary min-h-11 rounded-full border-2 px-4 font-semibold'
                      : 'border-line-strong bg-surface hover:bg-sunken min-h-11 rounded-full border px-4 font-semibold'
                  }
                >
                  {t.name}
                  {premium && !isPremium && (
                    <span className="text-ink-muted ml-1.5 text-xs">Premium</span>
                  )}
                </button>
              ))}
            </div>
            {chosenPremium && !isPremium && (
              <p className="text-ink-muted text-sm">
                {getTemplate(chosen).name} is a Premium design. You can edit in it now; downloading
                needs Premium, or switch to a free design any time with your words kept.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={open} iconAfter={<ArrowRight aria-hidden size={18} />}>
              Open in the editor
            </Button>
            <Button
              variant="ghost"
              icon={<RotateCcw aria-hidden size={18} />}
              onClick={() => {
                setResult(null);
                setTemplateId(null);
              }}
            >
              Import a different file
            </Button>
          </div>
        </div>
        <div className="bg-sunken rounded-lg p-3 sm:p-5">
          <DocumentPreview
            doc={preview}
            title={`Your imported CV in the ${getTemplate(chosen).name} design`}
          />
        </div>
      </div>
    );
  }

  // ---------- upload ----------
  return (
    <div className="flex flex-col gap-4">
      {left === 0 ? (
        <Banner
          tone="warning"
          title={
            limit === 0
              ? 'Importing is part of Premium.'
              : `You’ve used all ${limit} imports for this month.`
          }
          action={
            ent.features.sales ? (
              <ButtonLink href="/premium" size="sm">
                See Premium
              </ButtonLink>
            ) : undefined
          }
        >
          You can still create a CV from scratch — it only takes a few minutes.
        </Banner>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={
            drag
              ? 'border-primary bg-primary-soft flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center'
              : 'border-line-strong bg-surface flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center'
          }
        >
          {busy ? (
            <>
              <Spinner />
              <p className="font-semibold" role="status">
                Reading your CV…
              </p>
            </>
          ) : (
            <>
              <FileUp aria-hidden size={36} className="text-primary" />
              <p className="text-lg font-semibold">Drop your CV here</p>
              <p className="text-ink-muted">PDF or Word (.docx), up to 5 MB</p>
              <input
                ref={input}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-label="Choose your CV file (PDF or Word)"
                id="cv-file"
                data-testid="cv-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void upload(f);
                }}
              />
              <Button onClick={() => input.current?.click()}>Choose a file</Button>
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger" data-testid="import-error">
          {error}
        </p>
      )}
      <ul className="text-ink-muted flex flex-col gap-1 text-sm">
        {left !== Infinity && left > 0 && (
          <li data-testid="imports-left">
            {left} of {limit} imports left this month. An import only counts when it works.
          </li>
        )}
        <li>We read the text and don’t keep your file. Nothing is added that isn’t in your CV.</li>
        <li>
          Scanned pictures of a CV can’t be read yet — use the Word file or a PDF saved from Word.
        </li>
      </ul>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const listJoin = (a: string[]) =>
  a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
