import type { DesignSpec, TemplateId } from '@/modules/resume/schema';
import { DENSITY } from '@/modules/templates/design';
import { getTemplate } from '@/modules/templates/registry';
import { parseSpec, type DesignSpecV2, type DesignSpecV2Input } from './spec';

/**
 * The 10 hand-crafted designs as Design Spec v2 data. Attached (baseId set) they render with
 * their signature code; the other fields describe the same design in the generic vocabulary, so
 * a person (or the AI) who changes a structural choice starts from a close generic version.
 */
const C: Record<TemplateId, DesignSpecV2Input> = {
  clarity: {
    header: { style: 'plain', name: { size: 'XL' }, contact: { layout: 'inline', icons: true } },
    headings: { style: 'rule-after', case: 'upper', size: 'S', weight: 700 },
    entries: { layout: 'dates-right' },
    lists: { skills: { style: 'inline' } },
    decor: { kind: 'signature:clarity' },
  },
  meridian: {
    layout: { type: 'sidebar-right', sideWidthPct: 31, sideFill: 'tint' },
    placement: { side: ['skills', 'languages', 'certifications', 'licences', 'awards'] },
    header: { style: 'band', band: 'angled', photo: { shape: 'circle', position: 'header-left' } },
    headings: { style: 'underline', case: 'upper' },
    lists: { skills: { style: 'tags' } },
    decor: { kind: 'signature:meridian' },
  },
  heritage: {
    header: { style: 'monogram', align: 'center', photo: { show: false } },
    headings: { style: 'rule-after', case: 'small-caps', color: 'ink', weight: 600 },
    entries: { layout: 'dates-right' },
    bullets: { marker: 'dash', color: 'ink' },
    lists: { skills: { style: 'inline' } },
    decor: { kind: 'signature:heritage' },
  },
  atelier: {
    layout: { type: 'sidebar-left', sideWidthPct: 33, sideFill: 'deep', sideBleed: true },
    placement: {
      side: ['skills', 'languages', 'certifications', 'licences', 'awards'],
      contactIn: 'side',
    },
    header: {
      style: 'in-sidebar',
      name: { size: 'XL', case: 'upper', trackingEm: 0.04 },
      photo: { shape: 'circle', position: 'side-top' },
      contact: { layout: 'stacked' },
    },
    headings: { style: 'bar-left', case: 'upper' },
    lists: { skills: { style: 'tags' } },
    decor: { kind: 'signature:atelier' },
  },
  ledger: {
    layout: { type: 'label-column' },
    header: { style: 'split', name: { size: 'XL', weight: 800 } },
    headings: { style: 'numbered', case: 'upper', color: 'ink' },
    bullets: { marker: 'dash' },
    lists: { skills: { style: 'inline' } },
    decor: { kind: 'signature:ledger' },
  },
  chronicle: {
    layout: { type: 'timeline' },
    header: { style: 'plain', name: { size: 'L' } },
    headings: { style: 'plain', case: 'upper' },
    entries: { layout: 'timeline-dots' },
    lists: { skills: { style: 'inline' } },
    decor: { kind: 'signature:chronicle' },
  },
  vivid: {
    layout: { type: 'sidebar-right', sideWidthPct: 32, sideFill: 'tint' },
    placement: { side: ['skills', 'languages', 'certifications', 'licences', 'awards'] },
    header: {
      style: 'band',
      band: 'gradient',
      name: { size: 'XL', weight: 800 },
      photo: { shape: 'circle', position: 'overlap', ring: true },
    },
    headings: { style: 'filled', case: 'upper' },
    lists: { skills: { style: 'tags' } },
    decor: { kind: 'signature:vivid' },
  },
  folio: {
    layout: { type: 'sidebar-right', sideWidthPct: 30, sideFill: 'none' },
    placement: { side: ['skills', 'languages', 'certifications', 'licences', 'awards'] },
    header: { style: 'split', name: { size: 'XL', twoTone: true, weight: 600 } },
    headings: { style: 'overline', case: 'small-caps', weight: 600 },
    lists: { skills: { style: 'grouped-list' } },
    decor: { kind: 'signature:folio' },
  },
  halo: {
    layout: { type: 'sidebar-left', sideWidthPct: 31, sideFill: 'tint' },
    placement: { side: ['skills', 'languages', 'certifications', 'licences', 'awards'] },
    header: {
      style: 'centered',
      align: 'center',
      photo: { shape: 'circle', position: 'header-left', ring: true },
    },
    headings: { style: 'plain', case: 'upper', size: 'S' },
    lists: { skills: { style: 'tags' } },
    decor: { kind: 'signature:halo' },
  },
  sprout: {
    layout: { type: 'sidebar-left', sideWidthPct: 30, sideFill: 'tint' },
    placement: { side: ['skills', 'languages', 'certifications', 'licences', 'awards'] },
    header: { style: 'card', photo: { shape: 'circle', position: 'header-left' } },
    headings: { style: 'boxed', case: 'normal' },
    sections: { container: 'card' },
    bullets: { marker: 'check' },
    lists: { skills: { style: 'tags' } },
    decor: { kind: 'signature:sprout' },
  },
};

/** A catalogue design as a spec, attached to its signature code. */
export function catalogueSpec(id: TemplateId): DesignSpecV2 {
  return parseSpec({ ...C[id], baseId: id });
}

/**
 * v1 design settings → Design Spec v2 (attached to the same catalogue design). The overridable
 * fields carry the v1 values, so the attached spec renders exactly like the v1 design.
 */
export function migrateV1(d: DesignSpec): DesignSpecV2 {
  const base = catalogueSpec(d.templateId);
  const t = getTemplate(d.templateId);
  const density = DENSITY[d.density];
  return {
    ...base,
    page: { ...base.page, size: d.pageSize, marginMm: density.marginMm },
    color: { ...base.color, accent: d.accent },
    type: { pair: d.fontPair, basePt: density.bodyPt, lineHeight: density.lineHeight },
    spacing: {
      density: d.density,
      sectionGapPt: density.sectionGapPt,
      itemGapPt: density.itemGapPt,
    },
    header: {
      ...base.header,
      align: d.options?.headerAlign ?? t.support.defaults.headerAlign,
      photo: {
        ...base.header.photo,
        show: d.options?.showPhoto !== false && base.header.photo.show,
      },
    },
    lists: {
      ...base.lists,
      skills: {
        ...base.lists.skills,
        style: d.options?.skillStyle ?? t.support.defaults.skillStyle,
      },
    },
  };
}

/** The v1 settings a spec corresponds to (kept in sync so v1 readers still work). */
export function toV1(spec: DesignSpecV2, fallback: DesignSpec): DesignSpec {
  const skill = spec.lists.skills.style;
  return {
    ...fallback,
    templateId: spec.baseId ?? fallback.templateId,
    accent: spec.color.accent,
    fontPair: spec.type.pair,
    density: spec.spacing.density,
    pageSize: spec.page.size,
    options: {
      ...fallback.options,
      headerAlign: spec.header.align,
      ...(skill === 'tags' || skill === 'inline' ? { skillStyle: skill } : {}),
      showPhoto: spec.header.photo.show,
    },
  };
}

/** Apply a change made with the v1 controls (colour, font, spacing, paper…) to a v2 spec. */
export function applyV1Change(
  spec: DesignSpecV2,
  next: DesignSpec,
  patch: Partial<DesignSpec>,
): DesignSpecV2 {
  const out = structuredClone(spec);
  if (patch.accent) out.color.accent = next.accent;
  if (patch.fontPair) out.type.pair = next.fontPair;
  if (patch.pageSize) out.page.size = next.pageSize;
  if (patch.density) {
    const d = DENSITY[next.density];
    out.spacing = { density: next.density, sectionGapPt: d.sectionGapPt, itemGapPt: d.itemGapPt };
    out.type = { ...out.type, basePt: d.bodyPt, lineHeight: d.lineHeight };
    out.page.marginMm = d.marginMm;
  }
  const o = patch.options;
  if (o?.headerAlign) out.header.align = o.headerAlign;
  if (o?.skillStyle) out.lists.skills.style = o.skillStyle;
  if (o?.showPhoto !== undefined) out.header.photo.show = o.showPhoto;
  return out;
}
