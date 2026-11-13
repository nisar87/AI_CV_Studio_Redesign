'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Crown, ImagePlus, Sparkles, Wand2, X } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button, ButtonLink } from '@/components/ui/button';
import { deviceId, useAi } from '@/features/ai/client';
import { remaining, useEntitlements } from '@/features/account/entitlements';
import { DocumentPreview, type PreviewStatus } from '@/features/preview/document-preview';
import { designSpec } from '@/modules/design/catalogue';
import { DESIGN_META } from '@/modules/design/designs';
import {
  applyRefine,
  candidateSpecs,
  currentForPrompt,
  designStats,
  nearestCatalogue,
  specOf,
  type Candidate,
  type ComposeCandidate,
} from '@/modules/design/designer';
import { DENSITY } from '@/modules/templates/design';
import type { DesignSpecV2 } from '@/modules/design/spec';
import { ops } from '@/modules/resume/ops';
import type { PresetId } from '@/modules/resume/professions';
import type { ResumeDocument } from '@/modules/resume/schema';
import type { DocumentEditor } from './use-document-editor';

/** Example prompts per kind of work (spec §7.7: examples that change by profession). */
const EXAMPLES: Partial<Record<PresetId, string[]>> & { general: string[] } = {
  general: [
    'Clean, one column, navy',
    'Two columns with skills on the left',
    'Modern with a colour banner',
  ],
  tech: [
    'Three columns, navy, compact',
    'Minimal, section names in a margin',
    'Two columns, dark sidebar',
  ],
  teacher: ['Warm, two columns, round photo', 'Calm and classic, green', 'Timeline of my jobs'],
  healthcare: ['Clean and calm, teal', 'Two columns, photo top right', 'Compact, one page'],
  executive: ['Elegant serif, centred name', 'Black and white, classic', 'Navy and gold, refined'],
  driver: ['Simple timeline, blue', 'Big clear headings', 'One column, compact'],
  trades: ['Timeline with a colour stripe', 'Bold headings in boxes', 'Simple, orange'],
  student: ['Bold banner, purple', 'Cards in two columns', 'Fresh and friendly, ticks for bullets'],
  retail: ['Friendly, two columns, photo', 'Bold banner, red', 'Cards, colourful headings'],
  office: ['Clean, two columns, navy', 'Professional, underlined headings', 'Compact, one page'],
};

const MAX_IMAGE = 4 * 1024 * 1024;

type Shown = Candidate & { key: string; fallback?: boolean };

/** Fit-check repair steps (spec §7.4), two passes at most. */
const REPAIRS: ((s: DesignSpecV2) => void)[] = [
  (s) => {
    s.layout.sideWidthPct = Math.max(
      s.layout.type === 'rails' ? 20 : 24,
      s.layout.sideWidthPct - 4,
    );
    if (s.lists.skills.style !== 'inline') s.lists.skills = { ...s.lists.skills, style: 'inline' };
  },
  (s) => {
    const d = DENSITY.compact;
    s.spacing = { density: 'compact', sectionGapPt: d.sectionGapPt, itemGapPt: d.itemGapPt };
    s.layout.continuation = 'full-width';
  },
];

function CandidateCard({
  doc,
  c,
  best,
  onUse,
  onDrop,
}: {
  doc: ResumeDocument;
  c: Shown;
  best: boolean;
  onUse: (spec: DesignSpecV2) => void;
  onDrop: () => void;
}) {
  const [spec, setSpec] = useState(c.spec);
  const [passes, setPasses] = useState(0);
  const [status, setStatus] = useState<PreviewStatus | null>(null);
  const onStatus = useCallback(
    (st: PreviewStatus) => {
      setStatus(st);
      if (st.overflow === 0) return;
      if (passes >= REPAIRS.length) return onDrop();
      const next = structuredClone(spec);
      REPAIRS[passes]!(next);
      setPasses(passes + 1);
      setSpec(next);
    },
    [passes, spec, onDrop],
  );
  const preview = { ...doc, design: { ...doc.design, v2: spec } };
  return (
    <li
      className="border-line bg-surface flex flex-col gap-2 rounded-lg border p-2"
      data-testid="designer-candidate"
      data-ready={status && status.overflow === 0 ? '' : undefined}
    >
      <div className="ring-line overflow-hidden rounded-[3px] ring-1">
        <DocumentPreview
          doc={preview}
          firstPageOnly
          onStatus={onStatus}
          decorative
          title={`${c.name} design preview`}
        />
      </div>
      <div className="flex flex-col gap-0.5 px-1">
        <p className="font-semibold">
          {c.name}
          {best && (
            <span className="text-primary ml-2 text-xs font-semibold uppercase">Closest</span>
          )}
        </p>
        <p className="text-ink-muted text-sm">
          {c.fallback ? `The closest design from our catalogue: ${c.name}.` : c.explanation}
        </p>
        {c.unmet.map((u) => (
          <p
            key={u}
            className="bg-sunken text-ink-muted rounded px-2 py-1 text-xs"
            data-testid="designer-unmet"
          >
            {u}
          </p>
        ))}
      </div>
      <Button size="sm" onClick={() => onUse(spec)} aria-label={`Use the ${c.name} design`}>
        Use this
      </Button>
    </li>
  );
}

/**
 * AI Designer — Design Studio level 1 (complete-studio-spec §7.4, §7.7): describe the CV you
 * imagine (and/or add a picture of one you like) → three live designs of your own CV → refine in
 * words. Every change is one undo step.
 */
export function Designer({ editor }: { editor: DocumentEditor }) {
  const { doc, update } = editor;
  const ai = useAi();
  const { ent, refresh } = useEntitlements();
  const id = useId();
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ name: string; data: string; url: string } | null>(null);
  const [busy, setBusy] = useState<null | 'compose' | 'refine'>(null);
  const [error, setError] = useState<{
    message: string;
    premium?: boolean;
    signIn?: boolean;
  } | null>(null);
  const [shown, setShown] = useState<Shown[]>([]);
  const [refineText, setRefineText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attempt = useRef(0);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  if (!ai.show || !ent?.features.designer) return null;
  const limit = ent.limits['design.ai'];
  const left = ent.plan === 'visitor' ? 0 : remaining(ent, 'design.ai');
  const examples = EXAMPLES[doc.presetId as PresetId] ?? EXAMPLES.general;

  const fail = (code: string, message: string) =>
    setError({
      message,
      premium: code === 'PREMIUM_REQUIRED' || code === 'LIMIT_REACHED',
      signIn: code === 'SIGN_IN_REQUIRED',
    });

  async function compose() {
    setBusy('compose');
    setError(null);
    setNote(null);
    try {
      const res = await fetch('/api/designs/compose', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-id': deviceId() },
        body: JSON.stringify({
          input: {
            description: text.trim().slice(0, 600),
            presetId: doc.presetId,
            stats: designStats(doc),
            ...currentForPrompt(doc.design),
          },
          ...(image ? { image: { data: image.data } } : {}),
          attempt: attempt.current++,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        result?: { candidates: ComposeCandidate[] };
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || !json?.result) {
        fail(
          json?.error?.code ?? 'AI_UNAVAILABLE',
          json?.error?.message ?? 'The AI Designer couldn’t answer just now.',
        );
        return;
      }
      const list = candidateSpecs(json.result.candidates, doc.design);
      setShown(list.map((c, i) => ({ ...c, key: `${attempt.current}-${i}` })));
      refresh();
    } catch {
      fail(
        'AI_UNAVAILABLE',
        'We couldn’t reach the AI Designer. Check your connection and try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  /** A candidate that still overflows after two repair passes is replaced by the nearest catalogue design. */
  function drop(key: string) {
    setShown((list) => {
      const i = list.findIndex((c) => c.key === key);
      if (i < 0) return list;
      const near = nearestCatalogue(list[i]!.spec, doc.design);
      const meta = DESIGN_META[near];
      if (list.some((c) => c.fallback && c.startFrom === near))
        return list.filter((c) => c.key !== key);
      const next = [...list];
      next[i] = {
        name: meta.name,
        explanation: meta.description,
        unmet: [],
        spec: designSpec(near, doc.design),
        startFrom: near,
        key: `${key}-fallback`,
        fallback: true,
      };
      return next;
    });
  }

  async function refine() {
    setBusy('refine');
    setError(null);
    setNote(null);
    try {
      const res = await fetch('/api/designs/refine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-id': deviceId() },
        body: JSON.stringify({
          input: {
            instruction: refineText.trim().slice(0, 300),
            current: currentForPrompt(doc.design).current,
          },
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        result?: { changes: { field: string; value: string }[]; note: string };
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || !json?.result) {
        fail(
          json?.error?.code ?? 'AI_UNAVAILABLE',
          json?.error?.message ?? 'The AI Designer couldn’t answer just now.',
        );
        return;
      }
      const { changes, note: said } = json.result;
      const out = applyRefine(specOf(doc.design), changes, doc.design);
      if (out.applied.length) {
        update((x) => ops.setSpec(x, out.spec));
        setRefineText('');
      }
      setNote(said || (out.applied.length ? 'Done.' : 'Nothing to change for that.'));
    } catch {
      fail(
        'AI_UNAVAILABLE',
        'We couldn’t reach the AI Designer. Check your connection and try again.',
      );
    } finally {
      setBusy(null);
    }
  }

  function pick(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size > MAX_IMAGE) {
      setError({ message: 'Please choose a JPG, PNG, WebP or HEIC picture under 4 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(',')[1] ?? '';
      setImage({ name: file.name, data, url: URL.createObjectURL(file) });
    };
    reader.readAsDataURL(file);
  }

  const canCompose = (text.trim().length >= 2 || !!image) && busy === null;
  return (
    <section
      aria-labelledby={id}
      data-testid="designer"
      className="bg-primary-soft/60 border-primary/20 flex flex-col gap-3 rounded-lg border p-3"
    >
      <div>
        <h3 id={id} className="flex items-center gap-1.5 text-[17px] font-semibold">
          <Sparkles aria-hidden size={18} className="text-primary" /> Describe the CV you imagine
        </h3>
        <p className="text-ink-muted text-sm">
          Columns, colours, headings, photo — in your own words. We design it with your CV.
          {ent.plan === 'free' && limit > 0 && (
            <>
              {' '}
              You have {left} free design{left === 1 ? '' : 's'} to try; downloading it needs
              Premium.
            </>
          )}
        </p>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canCompose) void compose();
        }}
      >
        <label htmlFor={`${id}-in`} className="sr-only">
          Describe the CV you imagine
        </label>
        <textarea
          id={`${id}-in`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          rows={2}
          placeholder={`e.g. ${examples[0]}`}
          className="border-line-strong bg-surface focus-visible:border-primary focus-visible:ring-primary/25 min-h-16 rounded-sm border px-3 py-2 text-base focus-visible:ring-3 focus-visible:outline-none"
        />
        <div className="flex flex-wrap gap-1.5" aria-label="Examples">
          {examples.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setText(x)}
              className="border-line-strong text-ink-muted hover:bg-sunken rounded-full border px-2.5 py-0.5 text-xs"
            >
              {x}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            aria-label="Upload a picture of a CV you like"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {image ? (
            <span className="bg-surface ring-line inline-flex items-center gap-2 rounded-md py-1 pr-1 pl-1 text-sm ring-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the person's picture */}
              <img src={image.url} alt="" className="h-8 w-6 rounded-sm object-cover" />
              <span className="max-w-32 truncate">{image.name}</span>
              <button
                type="button"
                aria-label="Remove the picture"
                onClick={() => setImage(null)}
                className="hover:bg-sunken rounded p-1"
              >
                <X aria-hidden size={14} />
              </button>
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<ImagePlus aria-hidden size={16} />}
              onClick={() => fileRef.current?.click()}
            >
              Add a picture of a CV you like
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            className="ml-auto"
            disabled={!canCompose}
            icon={<Wand2 aria-hidden size={16} />}
          >
            {busy === 'compose' ? 'Designing…' : 'Design it'}
          </Button>
        </div>
      </form>

      {error && (
        <Banner
          tone={error.premium || error.signIn ? 'info' : 'warning'}
          title={error.message}
          action={
            error.signIn ? (
              <ButtonLink size="sm" href={`/signin?next=/cv/${doc.id}`}>
                Sign in
              </ButtonLink>
            ) : error.premium ? (
              <ButtonLink
                size="sm"
                href={`/premium?next=/cv/${doc.id}`}
                icon={<Crown aria-hidden size={14} />}
              >
                See Premium
              </ButtonLink>
            ) : undefined
          }
        />
      )}

      {busy === 'compose' && (
        <p className="text-ink-muted text-sm" role="status">
          Designing three versions of your CV…
        </p>
      )}
      {shown.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="grid grid-cols-2 gap-2 xl:grid-cols-3" aria-label="Designs for you">
            {shown.map((c, i) => (
              <CandidateCard
                key={c.key}
                doc={doc}
                c={c}
                best={i === 0 && !c.fallback}
                onDrop={() => drop(c.key)}
                onUse={(spec) => {
                  update((x) => ops.setSpec(x, spec));
                  setNote(`Now using “${c.name}”. Undo puts your previous design back.`);
                }}
              />
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void compose()}
              disabled={busy !== null || !canCompose}
            >
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShown([])}>
              Close
            </Button>
          </div>
        </div>
      )}

      <form
        className="flex flex-col gap-1.5 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (refineText.trim().length >= 2 && busy === null) void refine();
        }}
      >
        <label htmlFor={`${id}-refine`} className="sr-only">
          Change something about this design
        </label>
        <input
          id={`${id}-refine`}
          value={refineText}
          onChange={(e) => setRefineText(e.target.value)}
          maxLength={300}
          placeholder="Change something, e.g. make the sidebar narrower"
          className="border-line-strong bg-surface focus-visible:border-primary focus-visible:ring-primary/25 h-10 min-w-0 flex-1 rounded-sm border px-3 text-[15px] focus-visible:ring-3 focus-visible:outline-none"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={refineText.trim().length < 2 || busy !== null}
        >
          {busy === 'refine' ? 'Changing…' : 'Change'}
        </Button>
      </form>
      {note && (
        <p className="text-sm" role="status" data-testid="designer-note">
          {note}
        </p>
      )}
    </section>
  );
}
