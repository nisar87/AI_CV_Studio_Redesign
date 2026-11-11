import { describe, expect, it } from 'vitest';
import { createDocument } from '@/modules/resume/create';
import { FIXTURES } from '@/modules/resume/fixtures';
import { PRESET_IDS } from '@/modules/resume/professions';
import { parseResumeDocument, TEMPLATE_IDS } from '@/modules/resume/schema';
import { formatRange } from '@/modules/resume/dates';
import { contrast } from './color';
import { buildDocumentHtml } from './build-document';
import { ACCENT_PALETTE, resolveDesign } from './design';
import { listKeep } from './blocks';
import { TEMPLATES } from './registry';
import { toRenderModel } from './render-model';

const fonts = { kind: 'url' as const, baseUrl: 'https://cvstudio.test' };

describe('resume schema', () => {
  it.each(Object.entries(FIXTURES))('fixture %s is a valid document', (_, doc) => {
    expect(() => parseResumeDocument(doc)).not.toThrow();
  });

  it.each(PRESET_IDS)('preset %s creates a valid, empty document', (preset) => {
    const doc = createDocument(preset);
    expect(parseResumeDocument(doc).presetId).toBe(preset);
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('uses Letter for US and Canadian locales', () => {
    expect(createDocument('general', { locale: 'en-US' }).design.pageSize).toBe('Letter');
    expect(createDocument('general', { locale: 'en-GB' }).design.pageSize).toBe('A4');
  });

  it('rejects malformed dates and colours', () => {
    const bad = structuredClone(FIXTURES.driver) as unknown as { design: { accent: string } };
    bad.design.accent = 'blue';
    expect(() => parseResumeDocument(bad)).toThrow();
  });
});

describe('dates', () => {
  it('formats ranges in plain words', () => {
    expect(formatRange('2019-04', '', true)).toBe('Apr 2019 – Present');
    expect(formatRange('2015', '2018', false)).toBe('2015 – 2018');
    expect(formatRange('', '2013', false)).toBe('2013');
    expect(formatRange('2020', '2020', false)).toBe('2020');
    expect(formatRange('', '', false)).toBe('');
  });
});

describe('render model', () => {
  it('drops hidden sections, empty entries and empty bullets', () => {
    const doc = structuredClone(FIXTURES.driver);
    doc.sections[0]!.hidden = true;
    const exp = doc.sections.find((s) => s.kind === 'licences')!;
    (exp.items as unknown[]).push({ id: 'x', name: '', issuer: '', date: '', detail: '' });
    const model = toRenderModel(doc);
    expect(model.sections.map((s) => s.kind)).not.toContain('experience');
    expect(model.sections.find((s) => s.kind === 'licences')!.entries).toHaveLength(2);
  });

  it('puts the summary first and strips URL protocols', () => {
    const model = toRenderModel(FIXTURES.extreme);
    expect(model.sections[0]!.kind).toBe('summary');
    expect(model.contacts.find((c) => c.kind === 'link')!.text.startsWith('example.com')).toBe(
      true,
    );
  });

  it('handles a name-only CV', () => {
    const model = toRenderModel(FIXTURES.sparse);
    expect(model.sections).toEqual([]);
    expect(model.contacts).toHaveLength(1);
  });
});

describe('design resolution', () => {
  it('every palette colour meets 4.5:1 on white', () => {
    for (const c of ACCENT_PALETTE) expect(contrast(c.hex, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('darkens a too-light custom accent until it is readable', () => {
    const d = resolveDesign(
      { ...FIXTURES.driver.design, accent: '#ffd400' },
      TEMPLATES.clarity.support,
    );
    expect(contrast(d.accent, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('ignores options a template does not support', () => {
    const d = resolveDesign(
      { ...FIXTURES.driver.design, options: { headerAlign: 'center' } },
      TEMPLATES.meridian.support,
    );
    expect(d.headerAlign).toBe('left');
  });
});

describe('document builder', () => {
  it('is deterministic', () => {
    expect(buildDocumentHtml(FIXTURES.teacher, { fonts })).toBe(
      buildDocumentHtml(FIXTURES.teacher, { fonts }),
    );
  });

  it('escapes user content (no HTML injection)', () => {
    const doc = structuredClone(FIXTURES.driver);
    doc.basics.name = '<img src=x onerror=alert(1)>';
    doc.basics.summary = '</script><script>alert(1)</script>';
    const html = buildDocumentHtml(doc, { fonts });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('&lt;img src=x');
  });

  it('switching template, colour, font or density never changes the content', () => {
    const textOf = (html: string) =>
      html
        .replace(/<style>[\s\S]*?<\/style>|<script>[\s\S]*?<\/script>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[·|◆•:,—/]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .sort()
        .join(' ');
    const base = structuredClone(FIXTURES.engineer);
    const baseline = new Set(textOf(buildDocumentHtml(base, { fonts })).split(' '));
    for (const templateId of TEMPLATE_IDS) {
      for (const density of ['compact', 'airy'] as const) {
        const doc = structuredClone(base);
        doc.design = { ...doc.design, templateId, density, fontPair: 'classic', accent: '#7a2e4d' };
        const words = new Set(textOf(buildDocumentHtml(doc, { fonts })).split(' '));
        // Every word of content appears in every design (labels like "LinkedIn:" aside).
        for (const w of baseline)
          expect(words.has(w), `${templateId}/${density} lost "${w}"`).toBe(true);
      }
      expect(base).toEqual(FIXTURES.engineer);
    }
  });

  it('places side-column kinds in the aside flow only for Meridian', () => {
    const meridian = buildDocumentHtml(
      { ...FIXTURES.teacher, design: { ...FIXTURES.teacher.design, templateId: 'meridian' } },
      { fonts },
    );
    const clarity = buildDocumentHtml(
      { ...FIXTURES.teacher, design: { ...FIXTURES.teacher.design, templateId: 'clarity' } },
      { fonts },
    );
    const markup = (h: string) => h.slice(0, h.indexOf('<script>'));
    expect(markup(meridian)).toContain('<div data-flow="aside">');
    expect(markup(clarity)).not.toContain('<div data-flow="aside">');
  });
});

describe('list keep rules', () => {
  it('keeps short lists together and never strands one item', () => {
    expect([0, 1, 2].map((i) => listKeep(i, 3))).toEqual(['with-next', 'with-next', 'together']);
    expect([0, 1, 2, 3, 4, 5].map((i) => listKeep(i, 6))).toEqual([
      'with-next',
      'together',
      'together',
      'together',
      'with-next',
      'together',
    ]);
  });
});

describe('block classes', () => {
  it('marks the first item of every list section with a separate b-first class', () => {
    const html = buildDocumentHtml(FIXTURES.teacher, { fonts });
    expect(html).not.toMatch(/b-(skills|compact|entry)b-first/);
    expect(html).toMatch(/class="b-skills b-first/);
  });
});

describe('class name integrity', () => {
  it('never glues class names together (guards against formatter rewrites)', async () => {
    const { TEMPLATE_IDS } = await import('@/modules/resume/schema');
    for (const templateId of TEMPLATE_IDS) {
      const doc = { ...FIXTURES.engineer, design: { ...FIXTURES.engineer.design, templateId } };
      const html = buildDocumentHtml(doc, { fonts });
      expect(html, templateId).not.toMatch(/[a-z]b-first|wrapcv-|stackedcv-/);
    }
  });
});

describe('needs-input markers', () => {
  it('highlights {{?…}} only in text, never inside attributes', async () => {
    const { markPlaceholders } = await import('./build-document');
    expect(
      markPlaceholders('<p title="{{?x}}">Delivered {{?how many?}} parcels &amp; more</p>'),
    ).toBe(
      '<p title="{{?x}}">Delivered <mark class="cv-ask">[how many?]</mark> parcels &amp; more</p>',
    );
  });
});
