'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bookmark, Minimize2, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/features/account/account-context';
import type { PreviewStatus } from '@/features/preview/document-preview';
import { cn } from '@/lib/cn';
import { migrateV1 } from '@/modules/design/catalogue';
import { normalise } from '@/modules/design/normalise';
import {
  BACKGROUNDS,
  COMPACT_KINDS,
  CONTAINERS,
  DATE_FORMATS,
  DECOR_KINDS,
  DIVIDERS,
  ENTRY_LAYOUTS,
  HEADER_STYLES,
  HEADING_STYLES,
  INKS,
  LAYOUTS,
  MARKERS,
  type CompactKind,
  type DesignSpecV2,
} from '@/modules/design/spec';
import { DENSITY } from '@/modules/templates/design';
import { currentDesignId } from '@/modules/design/catalogue';
import { DESIGN_META } from '@/modules/design/designs';
import { ops } from '@/modules/resume/ops';
import type { DocumentEditor } from './use-document-editor';

type Opt<T extends string | number> = { value: T; label: string };
const words = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace(/-/g, ' ');
const opts = <T extends string>(vals: readonly T[], labels: Partial<Record<T, string>> = {}) =>
  vals.map((v) => ({ value: v, label: labels[v] ?? words(v) }));

const LAYOUT_LABEL: Partial<Record<(typeof LAYOUTS)[number], string>> = {
  single: 'One column',
  'sidebar-left': 'Side column left',
  'sidebar-right': 'Side column right',
  'two-equal': 'Two columns',
  rails: 'Three columns',
  'label-column': 'Headings in the margin',
  timeline: 'Timeline',
};
const KIND_LABEL: Record<CompactKind, string> = {
  skills: 'Skills',
  languages: 'Languages',
  certifications: 'Certificates',
  licences: 'Licences',
  awards: 'Awards',
};

/** A row of choices (radio group of chips). */
function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Opt<T>[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <p id={id} className="text-sm font-semibold">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-9 rounded-full border px-3 text-sm',
              o.value === value
                ? 'border-primary bg-primary-soft text-primary font-semibold'
                : 'border-line-strong bg-surface hover:bg-sunken',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-9 items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      <span className="flex justify-between">
        {label}
        <span className="text-ink-muted font-normal tabular-nums">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary min-h-9"
      />
    </label>
  );
}

function Group({
  title,
  children,
  open,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details className="border-line rounded-md border px-3 py-2" open={open}>
      <summary className="cursor-pointer py-1 font-semibold">{title}</summary>
      <div className="flex flex-col gap-4 py-3">{children}</div>
    </details>
  );
}

type Saved = { id: string; name: string; spec: DesignSpecV2 };

/**
 * Design Studio (complete-studio-spec §7.7), levels 2 ("Adjust") and 3 ("Fine-tune"), bound to
 * Design Spec v2 fields. A catalogue design stays attached while only its overridable choices
 * change; any other change makes it a custom design (composed), with one click back.
 */
export function DesignStudio({
  editor,
  status,
}: {
  editor: DocumentEditor;
  status: PreviewStatus | null;
}) {
  const { doc, update } = editor;
  const account = useAccount();
  const spec = useMemo(() => doc.design.v2 ?? migrateV1(doc.design), [doc.design]);
  const attached = !!(spec.baseId || spec.designId) && !spec.atsSafe;
  const baseId =
    currentDesignId({ ...doc.design, v2: spec }) ?? spec.origin ?? doc.design.templateId;
  const base = DESIGN_META[baseId];
  const notes = useMemo(() => normalise(spec, doc).unmet, [spec, doc]);

  /** Change the spec. `keepBase`: the change is one the catalogue design accepts as it is. */
  const edit = useCallback(
    (fn: (s: DesignSpecV2) => void, opt: { keepBase?: boolean; key?: string } = {}) => {
      update((x) => {
        const cur = x.design.v2 ?? migrateV1(x.design);
        const next = structuredClone(cur);
        fn(next);
        if (!opt.keepBase) {
          next.origin = cur.designId ?? cur.baseId ?? cur.origin;
          next.baseId = undefined;
          next.designId = undefined;
        }
        return ops.setSpec(x, next);
      }, opt.key);
    },
    [update],
  );

  // ---- Fit to one page
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [fitting, setFitting] = useState(false);
  const [fitReport, setFitReport] = useState<string | null>(null);
  const waitForLayout = async (prev: PreviewStatus | null) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (statusRef.current && statusRef.current !== prev) return statusRef.current;
    }
    return statusRef.current;
  };
  const fit = async () => {
    if (!statusRef.current || statusRef.current.pages <= 1) {
      setFitReport('It already fits on one page.');
      return;
    }
    setFitting(true);
    setFitReport(null);
    const steps: [string, (s: DesignSpecV2) => void, boolean][] = [
      [
        'compact spacing',
        (s) => {
          const d = DENSITY.compact;
          s.spacing = { density: 'compact', sectionGapPt: d.sectionGapPt, itemGapPt: d.itemGapPt };
          s.type.basePt = Math.min(s.type.basePt, d.bodyPt);
          s.type.lineHeight = Math.min(s.type.lineHeight, d.lineHeight);
          s.page.marginMm = Math.min(s.page.marginMm, d.marginMm);
        },
        true,
      ],
      ['skills as a list', (s) => void (s.lists.skills.style = 'inline'), true],
      [
        'smaller gaps',
        (s) => {
          s.spacing.sectionGapPt = Math.max(6, s.spacing.sectionGapPt * 0.75);
          s.spacing.itemGapPt = Math.max(3, s.spacing.itemGapPt * 0.7);
        },
        false,
      ],
      ['narrower margins', (s) => void (s.page.marginMm = Math.min(s.page.marginMm, 11)), false],
      [
        'narrower side column',
        (s) => void (s.layout.sideWidthPct = Math.max(24, s.layout.sideWidthPct - 4)),
        false,
      ],
      [
        'slightly smaller text',
        (s) => {
          s.type.basePt = 9.5;
          s.type.lineHeight = 1.32;
        },
        false,
      ],
    ];
    const done: string[] = [];
    for (const [label, step, keepBase] of steps) {
      if ((statusRef.current?.pages ?? 1) <= 1) break;
      if (attached && !keepBase) break;
      const prev = statusRef.current;
      edit(step, { keepBase });
      done.push(label);
      await waitForLayout(prev);
    }
    const pages = statusRef.current?.pages ?? 0;
    setFitting(false);
    setFitReport(
      pages <= 1
        ? `Now fits on one page. Changed: ${done.join(', ')}.`
        : `Still ${pages} pages after: ${done.join(', ')}.${attached ? ' Adjusting the design further (below) or shortening some points will help.' : ' Shortening some points will help.'} Undo puts it back.`,
    );
  };

  // ---- Saved designs
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [name, setName] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const signedIn = account.status === 'signedIn';
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    fetch('/api/designs', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { designs: [] }))
      .then((j: { designs: Saved[] }) => live && setSaved(j.designs))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signedIn]);
  const save = async () => {
    setSaveMsg(null);
    const r = await fetch('/api/designs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, spec }),
    });
    const j = (await r.json().catch(() => null)) as
      { design: Saved } | { error: { message: string } } | null;
    if (!r.ok || !j || 'error' in j) {
      setSaveMsg((j && 'error' in j && j.error.message) || 'That didn’t work. Please try again.');
      return;
    }
    setSaved((s) => [j.design, ...(s ?? [])]);
    setName('');
    setSaveMsg(`Saved “${j.design.name}”.`);
  };
  const remove = async (id: string) => {
    const r = await fetch(`/api/designs/${id}`, { method: 'DELETE' });
    if (r.ok) setSaved((s) => (s ?? []).filter((d) => d.id !== id));
  };

  const present = new Set(doc.sections.filter((s) => !s.hidden).map((s) => s.kind as string));
  const placeKinds = COMPACT_KINDS.filter((k) => present.has(k));
  const sideLayout = ['sidebar-left', 'sidebar-right', 'two-equal', 'rails'].includes(
    spec.layout.type,
  );

  return (
    <section aria-labelledby="studio-h" className="flex flex-col gap-4" data-testid="design-studio">
      <div>
        <h3 id="studio-h" className="text-[17px] font-semibold">
          Design Studio
        </h3>
        <p className="text-ink-muted text-sm" data-testid="studio-base">
          {spec.atsSafe
            ? 'ATS-safe version: one plain column that every screening system reads.'
            : attached
              ? `Based on ${base.name}. Changing a choice below makes it your own design.`
              : `Your own design, started from ${base.name}.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          label="ATS-safe version"
          checked={spec.atsSafe}
          onChange={(v) => edit((s) => void (s.atsSafe = v), { keepBase: true })}
        />
        <Button
          size="sm"
          variant="secondary"
          icon={<Minimize2 aria-hidden size={16} />}
          onClick={() => void fit()}
          loading={fitting}
          data-testid="fit-one-page"
        >
          Fit to one page
        </Button>
        {!attached && !spec.atsSafe && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw aria-hidden size={16} />}
            onClick={() => update((x) => ops.useDesign(x, baseId))}
          >
            Back to {base.name}
          </Button>
        )}
      </div>
      {fitReport && (
        <p
          className="bg-sunken rounded-md px-3 py-2 text-sm"
          role="status"
          data-testid="fit-report"
        >
          {fitReport}
        </p>
      )}
      {spec.atsSafe && (
        <p className="text-ink-muted flex items-start gap-1.5 text-sm">
          <ShieldCheck aria-hidden size={16} className="text-primary mt-0.5 shrink-0" />
          Your other choices are kept. Untick to go back to them.
        </p>
      )}
      {notes.length > 0 && (
        <ul className="text-ink-muted list-disc pl-5 text-sm" data-testid="studio-notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <Group title="Layout" open>
        <Choice
          label="Columns"
          value={spec.layout.type}
          options={opts(LAYOUTS, LAYOUT_LABEL)}
          onChange={(v) => edit((s) => void (s.layout.type = v))}
        />
        {sideLayout && (
          <>
            <Choice
              label="Side column colour"
              value={spec.layout.sideFill}
              options={opts(['none', 'tint', 'solid', 'deep'] as const, {
                none: 'None',
                tint: 'Light',
                solid: 'Medium',
                deep: 'Dark',
              })}
              onChange={(v) => edit((s) => void (s.layout.sideFill = v))}
            />
            <Toggle
              label="Colour runs to the page edge"
              checked={spec.layout.sideBleed}
              onChange={(v) => edit((s) => void (s.layout.sideBleed = v))}
            />
            <Toggle
              label="Keep the side column on every page"
              checked={spec.layout.continuation === 'keep-columns'}
              onChange={(v) =>
                edit((s) => void (s.layout.continuation = v ? 'keep-columns' : 'full-width'))
              }
            />
          </>
        )}
      </Group>

      <Group title="Header">
        <Choice
          label="Style"
          value={spec.header.style}
          options={opts(HEADER_STYLES, {
            band: 'Colour band',
            'in-sidebar': 'Beside the side column',
          })}
          onChange={(v) => edit((s) => void (s.header.style = v))}
        />
        {(spec.header.style === 'band' || spec.header.style === 'in-sidebar') && (
          <Choice
            label="Band"
            value={spec.header.band}
            options={opts(['solid', 'gradient', 'angled'] as const)}
            onChange={(v) => edit((s) => void (s.header.band = v))}
          />
        )}
        <Choice
          label="Name size"
          value={spec.header.name.size}
          options={opts(['S', 'M', 'L', 'XL'] as const, {
            S: 'Small',
            M: 'Medium',
            L: 'Large',
            XL: 'Huge',
          })}
          onChange={(v) => edit((s) => void (s.header.name.size = v))}
        />
        <Choice
          label="Name letters"
          value={spec.header.name.case}
          options={opts(['normal', 'upper', 'small-caps'] as const, {
            upper: 'Capitals',
            'small-caps': 'Small capitals',
          })}
          onChange={(v) => edit((s) => void (s.header.name.case = v))}
        />
        <Toggle
          label="Surname in the accent colour"
          checked={spec.header.name.twoTone}
          onChange={(v) => edit((s) => void (s.header.name.twoTone = v))}
        />
        <Choice
          label="Contact details"
          value={spec.header.contact.layout}
          options={opts(['inline', 'stacked', 'grid-2'] as const, {
            inline: 'In a row',
            stacked: 'One per line',
            'grid-2': 'Two columns',
          })}
          onChange={(v) => edit((s) => void (s.header.contact.layout = v))}
        />
        <Toggle
          label="Icons for phone, email and links"
          checked={spec.header.contact.icons}
          onChange={(v) => edit((s) => void (s.header.contact.icons = v))}
        />
        {doc.basics.photo && (
          <>
            <Choice
              label="Photo shape"
              value={spec.header.photo.shape}
              options={opts(['circle', 'rounded', 'square'] as const)}
              onChange={(v) => edit((s) => void (s.header.photo.shape = v))}
            />
            <Choice
              label="Photo position"
              value={spec.header.photo.position}
              options={opts(['header-left', 'header-right', 'side-top', 'overlap'] as const, {
                'header-left': 'Left',
                'header-right': 'Right',
                'side-top': 'Top of side column',
                overlap: 'Over the band',
              })}
              onChange={(v) => edit((s) => void (s.header.photo.position = v))}
            />
          </>
        )}
      </Group>

      <Group title="Colours">
        <Choice
          label="Colour use"
          value={spec.color.mode}
          options={opts(['mono', 'accent', 'duo'] as const, {
            mono: 'Black and white',
            accent: 'One colour',
            duo: 'Two colours',
          })}
          onChange={(v) =>
            edit((s) => {
              s.color.mode = v;
              if (v === 'duo' && !s.color.secondary) s.color.secondary = '#9a4a12';
            })
          }
        />
        {spec.color.mode === 'duo' && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="color"
              value={spec.color.secondary ?? '#9a4a12'}
              onChange={(e) =>
                edit((s) => void (s.color.secondary = e.target.value), { key: 'studio.second' })
              }
              className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            Second colour (headings)
          </label>
        )}
        <Choice
          label="Text colour"
          value={spec.color.ink}
          options={opts(INKS)}
          onChange={(v) => edit((s) => void (s.color.ink = v))}
        />
        <Choice
          label="Paper"
          value={spec.page.background}
          options={opts(BACKGROUNDS, { tint: 'Tinted' })}
          onChange={(v) => edit((s) => void (s.page.background = v))}
        />
      </Group>

      <Group title="Headings">
        <Choice
          label="Style"
          value={spec.headings.style}
          options={opts(HEADING_STYLES, {
            'rule-after': 'Line after',
            'bar-left': 'Bar on the left',
            filled: 'Coloured box',
          })}
          onChange={(v) => edit((s) => void (s.headings.style = v))}
        />
        <Choice
          label="Letters"
          value={spec.headings.case}
          options={opts(['normal', 'upper', 'small-caps'] as const, {
            upper: 'Capitals',
            'small-caps': 'Small capitals',
          })}
          onChange={(v) => edit((s) => void (s.headings.case = v))}
        />
        <Choice
          label="Colour"
          value={spec.headings.color}
          options={opts(['accent', 'ink'] as const, { accent: 'Accent', ink: 'Text colour' })}
          onChange={(v) => edit((s) => void (s.headings.color = v))}
        />
        <Toggle
          label="Icons next to headings"
          checked={spec.icons.sections}
          onChange={(v) => edit((s) => void (s.icons.sections = v))}
        />
      </Group>

      <Group title="Bullets, dates and skills">
        <Choice
          label="Bullets"
          value={spec.bullets.marker}
          options={opts(MARKERS)}
          onChange={(v) => edit((s) => void (s.bullets.marker = v))}
        />
        <Choice
          label="Dates"
          value={spec.entries.layout}
          options={opts(ENTRY_LAYOUTS, {
            'dates-right': 'On the right',
            'dates-left': 'On the left',
            stacked: 'Under the title',
            'timeline-dots': 'Timeline',
          })}
          onChange={(v) => edit((s) => void (s.entries.layout = v))}
        />
        <Choice
          label="Date style"
          value={spec.entries.dateFormat}
          options={opts(DATE_FORMATS)}
          onChange={(v) => edit((s) => void (s.entries.dateFormat = v))}
        />
        <Choice
          label="Job lines start with"
          value={spec.entries.lead}
          options={opts(['role', 'organisation'] as const, {
            role: 'Job title',
            organisation: 'Employer',
          })}
          onChange={(v) => edit((s) => void (s.entries.lead = v))}
        />
        <Choice
          label="Skills"
          value={spec.lists.skills.style}
          options={opts(['tags', 'inline', 'columns', 'grouped-list'] as const, {
            tags: 'Labels',
            inline: 'A list',
            'grouped-list': 'One per line',
          })}
          onChange={(v) =>
            edit((s) => void (s.lists.skills.style = v), {
              keepBase: v === 'tags' || v === 'inline',
            })
          }
        />
      </Group>

      <Group title="Spacing and lines">
        <Choice
          label="Sections"
          value={spec.sections.container}
          options={opts(CONTAINERS, {
            none: 'Plain',
            card: 'Cards',
            outlined: 'Outlined',
            'tinted-heading': 'Tinted headings',
          })}
          onChange={(v) => edit((s) => void (s.sections.container = v))}
        />
        <Choice
          label="Between sections"
          value={spec.sections.divider}
          options={opts(DIVIDERS, { 'accent-line': 'Coloured line', space: 'Extra space' })}
          onChange={(v) => edit((s) => void (s.sections.divider = v))}
        />
      </Group>

      <Group title="Extras">
        <Choice
          label="Decoration"
          value={
            spec.decor.kind.startsWith('signature:')
              ? 'none'
              : (spec.decor.kind as (typeof DECOR_KINDS)[number])
          }
          options={opts(DECOR_KINDS, {
            'top-bar': 'Top bar',
            'side-stripe': 'Side stripe',
            'corner-shapes': 'Shapes',
            'dot-grid': 'Dots',
            'watermark-initials': 'Initials',
          })}
          onChange={(v) => edit((s) => void (s.decor.kind = v))}
        />
        <Toggle
          label="Page numbers"
          checked={spec.furniture.pageNumbers}
          onChange={(v) => edit((s) => void (s.furniture.pageNumbers = v))}
        />
        <Toggle
          label="My name at the top of later pages"
          checked={spec.furniture.runningHeader}
          onChange={(v) => edit((s) => void (s.furniture.runningHeader = v))}
        />
        <Choice
          label="QR code"
          value={spec.extras.qr}
          options={opts(['none', 'portfolio', 'linkedin'] as const, {
            portfolio: 'My website',
            linkedin: 'LinkedIn',
          })}
          onChange={(v) => edit((s) => void (s.extras.qr = v))}
        />
        <Toggle
          label="“References available on request”"
          checked={spec.extras.referencesLine}
          onChange={(v) => edit((s) => void (s.extras.referencesLine = v))}
        />
      </Group>

      <Group title="Fine-tune">
        <Slider
          label="Page margin"
          unit=" mm"
          min={10}
          max={22}
          step={1}
          value={spec.page.marginMm}
          onChange={(v) => edit((s) => void (s.page.marginMm = v), { key: 'studio.margin' })}
        />
        <Slider
          label="Text size"
          unit=" pt"
          min={9.5}
          max={12}
          step={0.1}
          value={spec.type.basePt}
          onChange={(v) => edit((s) => void (s.type.basePt = v), { key: 'studio.size' })}
        />
        <Slider
          label="Line spacing"
          unit=""
          min={1.3}
          max={1.6}
          step={0.02}
          value={spec.type.lineHeight}
          onChange={(v) => edit((s) => void (s.type.lineHeight = v), { key: 'studio.lh' })}
        />
        <Slider
          label="Space between sections"
          unit=" pt"
          min={6}
          max={28}
          step={1}
          value={spec.spacing.sectionGapPt}
          onChange={(v) => edit((s) => void (s.spacing.sectionGapPt = v), { key: 'studio.sgap' })}
        />
        <Slider
          label="Space between entries"
          unit=" pt"
          min={3}
          max={18}
          step={0.5}
          value={spec.spacing.itemGapPt}
          onChange={(v) => edit((s) => void (s.spacing.itemGapPt = v), { key: 'studio.igap' })}
        />
        {sideLayout && (
          <Slider
            label="Side column width"
            unit="%"
            min={spec.layout.type === 'rails' ? 20 : 24}
            max={spec.layout.type === 'rails' ? 27 : 40}
            step={1}
            value={spec.layout.sideWidthPct}
            onChange={(v) => edit((s) => void (s.layout.sideWidthPct = v), { key: 'studio.side' })}
          />
        )}
        {sideLayout && placeKinds.length > 0 && (
          <div className="flex flex-col gap-2" data-testid="placement">
            <p className="text-sm font-semibold">Where sections go</p>
            {placeKinds.map((k) => {
              const where = spec.placement.side.includes(k)
                ? 'side'
                : spec.placement.third.includes(k)
                  ? 'third'
                  : 'main';
              return (
                <label key={k} className="flex items-center justify-between gap-3 text-sm">
                  {KIND_LABEL[k]}
                  <select
                    className="border-line-strong bg-surface h-9 rounded-md border px-2"
                    value={where}
                    onChange={(e) =>
                      edit((s) => {
                        s.placement.side = s.placement.side.filter((x) => x !== k);
                        s.placement.third = s.placement.third.filter((x) => x !== k);
                        if (e.target.value === 'side') s.placement.side.push(k);
                        if (e.target.value === 'third') s.placement.third.push(k);
                      })
                    }
                  >
                    <option value="main">Main column</option>
                    <option value="side">Side column</option>
                    {spec.layout.type === 'rails' && <option value="third">Right column</option>}
                  </select>
                </label>
              );
            })}
          </div>
        )}
      </Group>

      <div className="border-line flex flex-col gap-2 border-t pt-4">
        <p className="font-semibold">My designs</p>
        {!signedIn ? (
          <p className="text-ink-muted text-sm">Sign in to save designs and use them on any CV.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                className="border-line-strong bg-surface h-10 min-w-0 flex-1 rounded-md border px-3 text-sm"
                placeholder="Name this design"
                aria-label="Design name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
              />
              <Button
                size="sm"
                icon={<Bookmark aria-hidden size={16} />}
                onClick={() => void save()}
                disabled={!name.trim()}
              >
                Save as my design
              </Button>
            </div>
            {saveMsg && (
              <p className="text-sm" role="status" data-testid="save-design-msg">
                {saveMsg}
              </p>
            )}
            {saved && saved.length > 0 && (
              <ul className="flex flex-col gap-1.5" data-testid="my-designs">
                {saved.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      className="text-primary min-h-9 font-semibold hover:underline"
                      onClick={() => update((x) => ops.setSpec(x, d.spec))}
                    >
                      Use “{d.name}”
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${d.name}`}
                      className="text-ink-muted hover:text-danger inline-flex size-9 items-center justify-center"
                      onClick={() => void remove(d.id)}
                    >
                      <Trash2 aria-hidden size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
