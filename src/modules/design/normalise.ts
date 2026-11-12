import type { ResumeDocument } from '@/modules/resume/schema';
import { COMPACT_KINDS, type CompactKind, type DesignSpecV2 } from './spec';

/**
 * Hard design rules (complete-studio-spec §7.6), applied to every spec before it is composed.
 * Deterministic; returns the corrected spec and plain-language notes for anything changed.
 */
export type Normalised = { spec: DesignSpecV2; unmet: string[] };

const SIDE_LAYOUTS = new Set(['sidebar-left', 'sidebar-right', 'two-equal', 'rails']);
/** Longest section (characters) that may sit in a narrow column. */
export const NARROW_MAX_CHARS = 600;

function sectionChars(doc: ResumeDocument | undefined): Partial<Record<CompactKind, number>> {
  const out: Partial<Record<CompactKind, number>> = {};
  if (!doc) return out;
  for (const s of doc.sections) {
    if (s.hidden || !(COMPACT_KINDS as readonly string[]).includes(s.kind)) continue;
    const n = JSON.stringify(s.items).replace(/"id":"[^"]*"/g, '').length;
    out[s.kind as CompactKind] = (out[s.kind as CompactKind] ?? 0) + n;
  }
  return out;
}

export function atsSafeSpec(s: DesignSpecV2): DesignSpecV2 {
  return {
    ...s,
    baseId: undefined,
    layout: { ...s.layout, type: 'single' },
    placement: { side: [], third: [], contactIn: 'header' },
    header: {
      ...s.header,
      style: 'plain',
      headline: 'below',
      name: { ...s.header.name, twoTone: false },
      contact: { layout: 'inline', icons: false },
      photo: { ...s.header.photo, show: false },
    },
    headings: { ...s.headings, style: 'underline', case: 'upper' },
    sections: { container: 'none', divider: 'none' },
    entries: { ...s.entries, layout: 'dates-right' },
    bullets: { ...s.bullets, marker: 'disc' },
    lists: { ...s.lists, skills: { style: 'inline', columns: 1 }, languages: { style: 'text' } },
    decor: { kind: 'none', intensity: 'subtle' },
    icons: { ...s.icons, sections: false },
    extras: { ...s.extras, qr: 'none' },
    page: { ...s.page, background: 'white' },
  };
}

export function normalise(input: DesignSpecV2, doc?: ResumeDocument): Normalised {
  const unmet: string[] = [];
  let s: DesignSpecV2 = structuredClone(input);
  if (s.atsSafe) s = { ...atsSafeSpec(s), atsSafe: true };
  // Attached catalogue designs are already tested as they are.
  if (s.baseId) return { spec: s, unmet };

  const L = s.layout;
  const hasSide = SIDE_LAYOUTS.has(L.type);
  if (!hasSide) {
    s.placement = { ...s.placement, side: [], third: [], contactIn: 'header' };
  } else {
    if (L.type !== 'rails' && s.placement.third.length) {
      s.placement.side = [...new Set([...s.placement.side, ...s.placement.third])];
      s.placement.third = [];
    }
    s.placement.third = s.placement.third.filter((k) => !s.placement.side.includes(k));
    // Three columns with nothing chosen for the right one: share the side sections across both.
    if (L.type === 'rails' && !s.placement.third.length && s.placement.side.length >= 2) {
      const half = Math.ceil(s.placement.side.length / 2);
      s.placement.third = s.placement.side.slice(half);
      s.placement.side = s.placement.side.slice(0, half);
    }
    if (!s.placement.side.length && !s.placement.third.length && s.placement.contactIn !== 'side') {
      s.placement.side =
        L.type === 'rails'
          ? ['skills', 'languages']
          : ['skills', 'languages', 'certifications', 'licences', 'awards'];
      if (L.type === 'rails') s.placement.third = ['certifications', 'licences', 'awards'];
    }
    // Long sections belong in the main column (line length and parser safety).
    const chars = sectionChars(doc);
    for (const col of ['side', 'third'] as const) {
      const keep = s.placement[col].filter((k) => (chars[k] ?? 0) <= NARROW_MAX_CHARS);
      const moved = s.placement[col].filter((k) => !keep.includes(k));
      if (moved.length)
        unmet.push(`${moved.join(', ')} moved to the main column: too long for a narrow column.`);
      s.placement[col] = keep;
    }
    // Widths: side 24–40%; rails 20–27% each with main at least 46%.
    if (L.type === 'rails') L.sideWidthPct = Math.min(27, Math.max(20, L.sideWidthPct));
    else if (L.type === 'two-equal') L.sideWidthPct = 40;
    else L.sideWidthPct = Math.min(40, Math.max(24, L.sideWidthPct));
  }

  const H = s.header;
  if (H.style === 'in-sidebar' && !hasSide) H.style = 'plain';
  if (H.photo.position === 'side-top' && !hasSide) H.photo.position = 'header-right';
  if (H.photo.position === 'overlap' && H.style !== 'band') H.photo.position = 'header-right';

  // Bars and dots would show a level the person never gave.
  if (s.lists.skills.style === 'bars' || s.lists.skills.style === 'dots') {
    s.lists.skills.style = 'tags';
    unmet.push(
      'Skill bars and dots need skill levels, which this CV does not have, so tags are used.',
    );
  }
  if (s.lists.languages.style !== 'text') {
    s.lists.languages.style = 'text';
    unmet.push('Language bars and dots need levels, so languages are shown as text.');
  }

  // Signature artwork belongs to its catalogue design.
  if (s.decor.kind.startsWith('signature:')) s.decor.kind = 'none';

  // At most two colours plus ink.
  if (s.color.mode !== 'duo') s.color.secondary = undefined;
  else if (!s.color.secondary) s.color.mode = 'accent';

  return { spec: s, unmet };
}
