'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { ArrowRight, Crown } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { isPremiumDesign, useEntitlements } from '@/features/account/entitlements';
import { DocumentPreview } from '@/features/preview/document-preview';
import { designSpec } from '@/modules/design/catalogue';
import {
  DESIGNS,
  FAMILIES,
  FAMILY_LABEL,
  type DesignMeta,
  type Family,
} from '@/modules/design/designs';
import { FIXTURES, PHOTO_FOR, withPhoto } from '@/modules/resume/fixtures';
import { ops } from '@/modules/resume/ops';
import { PROFESSIONS, type PresetId } from '@/modules/resume/professions';
import type { DesignId, ResumeDocument } from '@/modules/resume/schema';
import { getRepository } from '@/modules/storage/repository';
import { cn } from '@/lib/cn';

/** Example CVs the gallery can show when the visitor has none of their own. */
export const SAMPLES = {
  driver: { label: 'Driver', doc: FIXTURES.driver },
  teacher: { label: 'Teacher', doc: FIXTURES.teacher },
  graduate: { label: 'Graduate', doc: FIXTURES.graduate },
  engineer: { label: 'Engineer', doc: FIXTURES.engineer },
} as const;
export type SampleId = keyof typeof SAMPLES;

/** A CV shown in a design: the sample (with a sample photo when the design has one) or the person's own. */
export function inDesign(doc: ResumeDocument, id: DesignId, sample?: string): ResumeDocument {
  const meta = DESIGNS.find((d) => d.id === id)!;
  const base = sample && meta.photo ? withPhoto(doc, PHOTO_FOR[sample] ?? 'a') : doc;
  return ops.useDesign(base, id);
}

/** Single-column designs (incl. timeline): position-sorted text keeps the section order. */
export function onlineSafe(d: DesignMeta): boolean {
  const t = designSpec(d.id, FIXTURES.teacher.design).layout.type;
  return t === 'single' || t === 'timeline';
}

/** "Show with": the person's own CVs on this device, then the samples. */
export function useShowWith() {
  const [own, setOwn] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const list = getRepository()
      .list()
      .slice(0, 5)
      .map((c) => ({ id: c.id, label: c.title || c.name || 'My CV' }));
    // Read once from this device's storage after mount (not available during server render).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage
    setOwn(list);
  }, []);
  return own;
}

export function TemplateGallery() {
  const { ent } = useEntitlements();
  const own = useShowWith();
  const [show, setShow] = useState<string>('sample:teacher');
  const [family, setFamily] = useState<Family | 'all'>('all');
  const [columns, setColumns] = useState<'any' | '1' | '2' | '3'>('any');
  const [photo, setPhoto] = useState<'any' | 'with' | 'without'>('any');
  const [work, setWork] = useState<PresetId | ''>('');
  const [online, setOnline] = useState(false);
  const ids = useId();

  // Default to the person's newest CV once it is known.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the one-time storage read
    if (own[0]) setShow(`own:${own[0].id}`);
  }, [own]);

  const { base, sample, label } = useMemo(() => {
    if (show.startsWith('own:')) {
      const doc = getRepository().get(show.slice(4));
      if (doc) return { base: doc, sample: undefined, label: 'your CV' };
    }
    const k = (show.split(':')[1] ?? 'teacher') as SampleId;
    const s = SAMPLES[k] ?? SAMPLES.teacher;
    return { base: s.doc, sample: k, label: `an example ${s.label.toLowerCase()} CV` };
  }, [show]);

  const shown = DESIGNS.filter(
    (d) =>
      (!ent || ent.designs.find((x) => x.id === d.id)?.enabled !== false) &&
      (family === 'all' || d.family === family) &&
      (columns === 'any' || String(d.columns) === columns) &&
      (photo === 'any' || (photo === 'with') === d.photo) &&
      (!work || (d.fit[work] ?? 0) >= 0.7) &&
      (!online || onlineSafe(d)),
  );
  const showPremium = (id: string) =>
    ent !== null && ent.plan !== 'premium' && isPremiumDesign(ent, id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4" role="search" aria-label="Find a design">
        <label className="flex flex-col gap-1.5 text-sm font-semibold sm:max-w-sm">
          Show the designs with
          <select
            value={show}
            onChange={(e) => setShow(e.target.value)}
            className="border-line-strong bg-surface min-h-11 rounded-md border px-3 text-[15px] font-normal"
          >
            {own.map((c) => (
              <option key={c.id} value={`own:${c.id}`}>
                My CV: {c.label}
              </option>
            ))}
            {(Object.keys(SAMPLES) as SampleId[]).map((k) => (
              <option key={k} value={`sample:${k}`}>
                An example {SAMPLES[k].label.toLowerCase()} CV
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Design families" className="flex flex-wrap gap-1.5">
          {(['all', ...FAMILIES] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={family === f}
              title={f === 'all' ? undefined : FAMILY_LABEL[f].hint}
              onClick={() => setFamily(f)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                family === f
                  ? 'bg-primary text-on-primary border-transparent'
                  : 'border-line-strong text-ink-muted hover:bg-sunken',
              )}
            >
              {f === 'all' ? 'All designs' : FAMILY_LABEL[f].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Segmented
            label="Columns"
            value={columns}
            onChange={setColumns}
            options={[
              { value: 'any', label: 'Any' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
            ]}
          />
          <Segmented
            label="Photo"
            value={photo}
            onChange={setPhoto}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'with', label: 'With' },
              { value: 'without', label: 'Without' },
            ]}
          />
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Suits
            <select
              value={work}
              onChange={(e) => setWork(e.target.value as PresetId | '')}
              className="border-line-strong bg-surface min-h-11 rounded-md border px-3 text-[15px] font-normal"
            >
              <option value="">Any kind of work</option>
              {PROFESSIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-[15px]">
            <input
              type="checkbox"
              checked={online}
              onChange={(e) => setOnline(e.target.checked)}
              className="size-5"
            />
            Best for online applications
          </label>
        </div>
        <p className="text-ink-muted text-sm" id={`${ids}-count`} aria-live="polite">
          {shown.length} design{shown.length === 1 ? '' : 's'}
          {family !== 'all' ? ` · ${FAMILY_LABEL[family].hint}` : ''}
        </p>
      </div>

      <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" aria-describedby={`${ids}-count`}>
        {shown.map((t, index) => (
          <li key={t.id} className="flex flex-col gap-3" data-design={t.id}>
            <Link
              href={`/templates/${t.id}${show.startsWith('own:') ? `?cv=${show.slice(4)}` : ''}`}
              className="bg-surface shadow-page hover:ring-primary relative block overflow-hidden rounded-[4px] hover:ring-2"
              aria-label={`${t.name}: see this design`}
            >
              {/* Static thumbnail shows at once; the live preview renders over it in view. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static webp */}
              <img
                src={`/templates/${t.id}.webp`}
                alt=""
                width={595}
                height={842}
                fetchPriority={index < 2 ? 'high' : 'auto'}
                loading={index < 2 ? 'eager' : 'lazy'}
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <DocumentPreview
                doc={inDesign(base, t.id, sample)}
                firstPageOnly
                decorative
                lazy
                debounceMs={0}
                title={`${t.name} design with ${label}`}
              />
              {showPremium(t.id) && (
                <span className="bg-ink/85 absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">
                  <Crown aria-hidden size={12} /> Premium
                </span>
              )}
            </Link>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">
                {t.name} <span className="text-ink-muted font-normal">· {t.style}</span>
              </h2>
              <p className="text-ink-muted text-sm">
                {FAMILY_LABEL[t.family].name} · {t.columns} column{t.columns > 1 ? 's' : ''}
                {t.photo ? ' · photo' : ''}
              </p>
              <p className="text-ink-muted">{t.description}</p>
            </div>
            <Link
              href={`/templates/${t.id}${show.startsWith('own:') ? `?cv=${show.slice(4)}` : ''}`}
              className="text-primary inline-flex items-center gap-1 self-start font-semibold"
            >
              See {t.name} <ArrowRight aria-hidden size={16} />
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p className="text-ink-muted">No design matches all of these. Try fewer filters.</p>
      )}
    </div>
  );
}
