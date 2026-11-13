'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, PencilLine, RotateCcw, Sparkles } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAccount } from '@/features/account/account-context';
import { useEntitlements } from '@/features/account/entitlements';
import { DocumentPreview } from '@/features/preview/document-preview';
import { cn } from '@/lib/cn';
import { applySuggestions, chipCounts, type Suggestion } from '@/modules/makeover/polish';
import { getProfession } from '@/modules/resume/professions';
import type { DesignId, ResumeDocument } from '@/modules/resume/schema';
import { getRepository } from '@/modules/storage/repository';
import { isProfile, makeProfile } from '@/modules/resume/profile';
import { CheckboxField } from '@/features/editor/fields';
import { currentDesignId } from '@/modules/design/catalogue';
import { ops } from '@/modules/resume/ops';
import { DESIGN_META } from '@/modules/design/designs';
import { BeforeView } from './before-view';
import { DropZone } from './drop-zone';
import { PolishChips } from './polish-panel';
import { clearPending, loadPending, savePending, takeHandOff, type MakeoverResult } from './state';

type Failure = { message: string; reason?: string };

export function withDesign(doc: ResumeDocument, id: DesignId): ResumeDocument {
  return ops.useDesign(doc, id);
}

function event(name: 'makeover_design_switch' | 'landing_view') {
  void fetch('/api/metrics/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => {});
}

/** Instant Makeover (spec §6): drop → watch it work → reveal → optional polish → download. */
export function MakeoverScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const account = useAccount();
  const { ent, refresh } = useEntitlements();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'working' | 'result'>('idle');
  const [steps, setSteps] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [result, setResult] = useState<MakeoverResult | null>(null);
  const [doc, setDoc] = useState<ResumeDocument | null>(null);
  const [templateId, setDesignId] = useState<DesignId>('clarity');
  const [saving, setSaving] = useState<'download' | 'edit' | null>(null);
  const [saveFailure, setSaveFailure] = useState<Failure | null>(null);
  const [placed, setPlaced] = useState<Record<string, 'added' | 'left'>>({});
  const autoAction = useRef<'download' | 'edit' | null>(null);
  // Offer "use as my career profile" when the account has none yet.
  const [asProfile, setAsProfile] = useState(false);
  const hasProfile = useMemo(
    () => phase !== 'result' || getRepository().list().some(isProfile),
    [phase],
  );

  const isPremium = ent?.plan === 'premium';
  const locked = useCallback(
    (id: DesignId) => !isPremium && ent?.designs.find((d) => d.id === id)?.tier === 'premium',
    [ent, isPremium],
  );

  const upload = useCallback(
    async (f: File) => {
      setFile(f);
      setFailure(null);
      setSaveFailure(null);
      setPlaced({});
      const image = /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
      const list = [
        'Reading your CV',
        ...(image ? ['Reading a scanned page'] : []),
        'Finding your jobs and dates',
        'Choosing designs for you',
        'Laying out your pages',
      ];
      setSteps(list);
      setStep(0);
      setPhase('working');
      // The server does the steps in one request; the list moves on while it works and is
      // completed when the answer arrives.
      const timer = window.setInterval(
        () => setStep((s) => Math.min(s + 1, list.length - 2)),
        image ? 4000 : 2500,
      );
      try {
        const form = new FormData();
        form.append('file', f);
        const region = (navigator.language || '').split('-')[1]?.toUpperCase();
        form.append('locale', `en-${region && /^[A-Z]{2}$/.test(region) ? region : 'GB'}`);
        const r = await fetch('/api/makeover', { method: 'POST', body: form });
        const j = (await r.json().catch(() => null)) as
          MakeoverResult | { error: { message: string; details?: { reason?: string } } } | null;
        if (!r.ok || !j || 'error' in j) {
          setFailure({
            message:
              (j && 'error' in j && j.error.message) ||
              'That didn’t work. Please try again in a moment.',
            reason: j && 'error' in j ? j.error.details?.reason : undefined,
          });
          setPhase('idle');
          return;
        }
        setStep(list.length);
        const first = j.ranking.find((x) => !locked(x.id)) ?? j.ranking[0];
        setResult(j);
        setDoc(j.document);
        setDesignId(first?.id ?? 'clarity');
        setPhase('result');
        refresh();
      } catch {
        setFailure({
          message: 'We couldn’t reach the server. Check your connection and try again.',
        });
        setPhase('idle');
      } finally {
        window.clearInterval(timer);
      }
    },
    [locked, refresh],
  );

  // A file dropped on the home page, or a makeover kept through sign-in. Deferred a tick so it
  // runs once (a cleared timer in React's development double-run does nothing).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const f = takeHandOff();
      if (f) {
        void upload(f);
        return;
      }
      if (params.get('resume') !== '1') return;
      const p = loadPending();
      if (!p) return;
      setResult(p.result);
      setDoc(p.doc);
      setDesignId(p.templateId);
      setPhase('result');
      autoAction.current = p.action;
    }, 0);
    return () => window.clearTimeout(t);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    async (action: 'download' | 'edit') => {
      if (!result || !doc) return;
      setSaveFailure(null);
      if (account.status !== 'signedIn') {
        savePending({ result, doc, templateId, action });
        router.push(`/signin?mode=signup&next=${encodeURIComponent('/makeover?resume=1')}`);
        return;
      }
      setSaving(action);
      try {
        const r = await fetch('/api/makeover/claim', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ makeoverId: result.makeoverId }),
        });
        const j = (await r.json().catch(() => null)) as
          { ok: true } | { error: { message: string; details?: { reason?: string } } } | null;
        if (!r.ok || !j || 'error' in j) {
          setSaveFailure({
            message:
              (j && 'error' in j && j.error.message) || 'That didn’t work. Please try again.',
            reason: j && 'error' in j ? j.error.details?.reason : undefined,
          });
          return;
        }
        const now = new Date().toISOString();
        const designed = withDesign(doc, templateId);
        const saved = asProfile
          ? makeProfile(designed)
          : { ...designed, createdAt: now, updatedAt: now };
        getRepository().save(saved);
        clearPending();
        router.push(action === 'download' ? `/cv/${saved.id}/download` : `/cv/${saved.id}`);
      } catch {
        setSaveFailure({ message: 'We couldn’t reach the server. Please try again.' });
      } finally {
        setSaving(null);
      }
    },
    [account.status, asProfile, doc, result, router, templateId],
  );

  // Back from sign-in: carry on with what the person clicked.
  useEffect(() => {
    if (account.status !== 'signedIn' || !autoAction.current) return;
    const a = autoAction.current;
    autoAction.current = null;
    void finish(a);
  }, [account.status, finish]);

  const preview = useMemo(() => (doc ? withDesign(doc, templateId) : null), [doc, templateId]);
  const counts = useMemo(() => (doc ? chipCounts(doc) : null), [doc]);

  // ---------- idle / working ----------
  if (phase !== 'result' || !result || !doc || !preview) {
    if (ent && !ent.features.import)
      return (
        <Banner tone="info" title="Importing is switched off right now. Please try again later." />
      );
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        {phase === 'working' ? (
          <Card className="flex flex-col gap-4 p-6" data-testid="makeover-progress">
            <h2 className="flex items-center gap-2 text-xl font-semibold" role="status">
              <Spinner /> Making over your CV…
            </h2>
            <ol className="flex flex-col gap-2">
              {steps.map((s, i) => (
                <li
                  key={s}
                  className={cn(
                    'flex items-center gap-2 text-[15px]',
                    i > step && 'text-ink-subtle',
                  )}
                >
                  {i < step ? (
                    <Check aria-hidden size={18} className="text-primary" />
                  ) : i === step ? (
                    <Spinner />
                  ) : (
                    <span aria-hidden className="inline-block w-[18px]" />
                  )}
                  {s}
                </li>
              ))}
            </ol>
            <p className="text-ink-muted text-sm">This usually takes 10–30 seconds.</p>
          </Card>
        ) : (
          <DropZone onFile={(f) => void upload(f)} />
        )}
        {failure && (
          <Banner tone="error" title={failure.message}>
            {failure.reason === 'sign_in' && (
              <ButtonLink size="sm" href="/signin?next=/makeover" className="mt-2">
                Sign in free
              </ButtonLink>
            )}
            {failure.reason === 'limit' && ent?.features.sales && (
              <ButtonLink size="sm" href="/premium" className="mt-2">
                See Premium
              </ButtonLink>
            )}
          </Banner>
        )}
        <ul className="text-ink-muted flex flex-col gap-1 text-sm">
          <li>No sign-in needed to see the result. We read your file and don’t keep it.</li>
          <li>Nothing is added that isn’t in your CV — every word is checked against your file.</li>
        </ul>
      </div>
    );
  }

  // ---------- result ----------
  const profession = getProfession(result.profile.presetId)?.name;
  const watermark = result.previewFor === 'limit';
  const missing = result.coverage.ratio < 0.97 ? result.coverage.missing : [];
  const openMissing = missing.filter((l) => !placed[l]);

  const accept = (s: Suggestion[]) => setDoc((d) => (d ? applySuggestions(d, s) : d));
  const addLine = (line: string) => {
    setPlaced((p) => ({ ...p, [line]: 'added' }));
    setDoc((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      let other = next.sections.find((s) => s.kind === 'custom' && s.title === 'Other');
      if (!other) {
        other = {
          id: crypto.randomUUID(),
          kind: 'custom',
          title: 'Other',
          hidden: false,
          items: [],
        };
        next.sections.push(other);
      }
      if (other.kind === 'custom')
        other.items.push({
          id: crypto.randomUUID(),
          title: '',
          subtitle: '',
          date: '',
          bullets: [line],
        });
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6" data-testid="makeover-result">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-semibold" data-testid="makeover-done">
          <Check aria-hidden className="text-primary" /> Here’s your new CV
        </h2>
        <p className="text-ink-muted">
          {profession
            ? `Read as ${/^[aeiou]/i.test(profession) ? 'an' : 'a'} ${profession.toLowerCase()} CV. `
            : ''}
          {result.method === 'ai'
            ? 'Sorted by AI, then checked word by word against your file — nothing was added.'
            : 'Everything is in editable sections. Check each one before you send it.'}
        </p>
      </div>

      {result.scanned && (
        <Banner tone="warning" title="Please check names and numbers" className="max-w-3xl">
          This was read from an image, so a word may have been misread.
        </Banner>
      )}
      {result.previewFor === 'visitor' && account.status !== 'signedIn' && (
        <Banner
          tone="info"
          title="Like it? Sign in free to save and download it."
          className="max-w-3xl"
        >
          Your new CV is kept while you sign in or create an account.
        </Banner>
      )}
      {watermark && (
        <Banner
          tone="warning"
          title="This is a preview — you’ve used this month’s imports."
          className="max-w-3xl"
          action={
            ent?.features.sales ? (
              <ButtonLink size="sm" href="/premium">
                See Premium
              </ButtonLink>
            ) : undefined
          }
        >
          You can still look at every design. Saving needs Premium or next month’s allowance.
        </Banner>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Compare file={file} lines={result.lines} doc={preview} watermark={watermark} />
        </div>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3" aria-labelledby="mk-designs">
            <h3 id="mk-designs" className="font-semibold">
              Designs chosen for you
            </h3>
            <div role="radiogroup" aria-labelledby="mk-designs" className="grid grid-cols-3 gap-3">
              {result.ranking.map((r, i) => {
                const t = DESIGN_META[r.id];
                const on = r.id === templateId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-testid="design-option"
                    data-design={r.id}
                    onClick={() => {
                      if (on) return;
                      setDesignId(r.id);
                      event('makeover_design_switch');
                    }}
                    title={r.reasons.length ? `${t.name}: ${r.reasons.join(', ')}` : t.name}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-md p-1.5 text-left',
                      on ? 'ring-primary ring-2' : 'hover:bg-sunken',
                    )}
                  >
                    <div className="bg-sunken pointer-events-none overflow-hidden rounded-sm">
                      <DocumentPreview
                        doc={withDesign(doc, r.id)}
                        firstPageOnly
                        decorative
                        debounceMs={i * 60}
                        title={`${t.name} design`}
                      />
                    </div>
                    <span className="text-sm font-semibold">
                      {t.name}
                      {locked(r.id) && (
                        <span className="text-ink-muted ml-1 text-xs font-normal">Premium</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {locked(templateId) && (
              <p className="text-ink-muted text-sm">
                {DESIGN_META[templateId].name} is a Premium design. You can save and edit in it;
                downloading needs Premium, or switch to a free design any time.
              </p>
            )}
          </section>

          {counts && (
            <PolishChips
              doc={doc}
              makeoverId={result.makeoverId}
              counts={counts}
              ai={result.ai}
              onAccept={accept}
              onBasics={(patch) =>
                setDoc((d) => (d ? { ...d, basics: { ...d.basics, ...patch } } : d))
              }
            />
          )}

          {openMissing.length > 0 && (
            <Card className="flex flex-col gap-3 p-4" data-testid="unplaced">
              <h3 className="font-semibold">
                We could not place {openMissing.length} line{openMissing.length === 1 ? '' : 's'}
              </h3>
              <ul className="flex flex-col gap-2">
                {openMissing.map((l) => (
                  <li key={l} className="flex flex-wrap items-center gap-2 text-[15px]">
                    <span className="min-w-0 flex-1">{l}</span>
                    <Button size="sm" variant="secondary" onClick={() => addLine(l)}>
                      Add to my CV
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPlaced((p) => ({ ...p, [l]: 'left' }))}
                    >
                      Leave out
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {saveFailure && (
            <Banner tone="error" title={saveFailure.message}>
              {(saveFailure.reason === 'limit' || saveFailure.reason === 'premium') &&
                ent?.features.sales && (
                  <ButtonLink size="sm" href="/premium" className="mt-2">
                    See Premium
                  </ButtonLink>
                )}
            </Banner>
          )}

          {account.status === 'signedIn' && !hasProfile && (
            <CheckboxField
              label="Use this as my career profile (the master record new CVs start from)"
              checked={asProfile}
              onChange={setAsProfile}
            />
          )}

          <div className="bg-paper sticky bottom-0 -mx-1 flex flex-wrap gap-3 px-1 py-3">
            <Button
              size="lg"
              onClick={() => void finish('download')}
              loading={saving === 'download'}
              icon={<Download aria-hidden size={18} />}
              data-testid="makeover-download"
            >
              Download PDF
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => void finish('edit')}
              loading={saving === 'edit'}
              icon={<PencilLine aria-hidden size={18} />}
              data-testid="makeover-edit"
            >
              Save and edit
            </Button>
            <Button
              variant="ghost"
              icon={<RotateCcw aria-hidden size={18} />}
              onClick={() => {
                clearPending();
                setResult(null);
                setDoc(null);
                setFile(null);
                setPhase('idle');
              }}
            >
              Try another file
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Before/after: the original under the new CV, with a slider to reveal one or the other. */
function Compare({
  file,
  lines,
  doc,
  watermark,
}: {
  file: File | null;
  lines: string[];
  doc: ResumeDocument;
  watermark: boolean;
}) {
  const [pos, setPos] = useState(file ? 50 : 100);
  const hasBefore = !!file;
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-sunken relative overflow-hidden rounded-lg p-3 sm:p-4">
        <div className="relative">
          <DocumentPreview
            doc={doc}
            debounceMs={0}
            title={`Your new CV in the ${DESIGN_META[currentDesignId(doc.design) ?? doc.design.templateId].name} design`}
          />
          {watermark && (
            <div
              aria-hidden
              data-testid="watermark"
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
            >
              <span className="text-ink/15 -rotate-30 text-[clamp(40px,9vw,110px)] font-black tracking-widest whitespace-nowrap select-none">
                PREVIEW
              </span>
            </div>
          )}
          {hasBefore && pos < 100 && (
            <div
              className="absolute inset-x-0 top-0 z-10 aspect-[210/297] overflow-hidden shadow-md"
              style={{ clipPath: `inset(0 ${pos}% 0 0)` }}
              data-testid="before-layer"
            >
              <BeforeView file={file} lines={lines} />
            </div>
          )}
        </div>
      </div>
      {hasBefore && (
        <label className="flex items-center gap-3 text-sm font-semibold">
          <span className="w-16 shrink-0">Before</span>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="accent-primary min-h-11 flex-1"
            aria-label="Compare your original CV with the new one"
            data-testid="compare-slider"
          />
          <span className="w-16 shrink-0 text-right">After</span>
        </label>
      )}
      {!hasBefore && (
        <p className="text-ink-muted flex items-center gap-1.5 text-sm">
          <Sparkles aria-hidden size={15} /> Your words, in a new design.
        </p>
      )}
    </div>
  );
}
