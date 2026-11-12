import { describe, expect, it } from 'vitest';
import { FIXTURES, PHOTO_FOR, withPhoto } from '@/modules/resume/fixtures';
import { FONT_PAIR_IDS, TEMPLATE_IDS, type ResumeDocument } from '@/modules/resume/schema';
import { buildDocumentHtml } from '@/modules/templates/build-document';
import { catalogueSpec, migrateV1, toV1 } from './catalogue';
import { formatDates } from './compose';
import { normalise } from './normalise';
import { documentDesign } from './render';
import { enumSweep, randomSpec, rng } from './samples';
import { parseSpec, type DesignSpecV2 } from './spec';

const fonts = { kind: 'url' as const, baseUrl: 'https://cvstudio.test' };
const fixtures = Object.values(FIXTURES);
const withSpec = (doc: ResumeDocument, v2: DesignSpecV2): ResumeDocument => ({
  ...doc,
  design: { ...doc.design, v2 },
});

describe('v1 → v2 migration is identical (R6 gate)', () => {
  // Every catalogue design × every fixture × the v1 options that change the output.
  const variants = (doc: ResumeDocument, id: (typeof TEMPLATE_IDS)[number]): ResumeDocument[] => {
    const d = { ...doc.design, templateId: id };
    return [
      { ...doc, design: d },
      {
        ...withPhoto(doc, PHOTO_FOR.driver),
        design: { ...d, pageSize: 'Letter', density: 'compact' },
      },
      {
        ...doc,
        design: {
          ...d,
          density: 'airy',
          accent: '#9a4a12',
          fontPair: FONT_PAIR_IDS[TEMPLATE_IDS.indexOf(id) % FONT_PAIR_IDS.length]!,
          options: { headerAlign: 'center', skillStyle: 'tags', showPhoto: false },
        },
      },
      { ...doc, design: { ...d, options: { skillStyle: 'inline' } } },
    ];
  };
  for (const id of TEMPLATE_IDS)
    it(`${id}: the migrated spec renders the same HTML for all fixtures and options`, () => {
      for (const f of fixtures)
        for (const doc of variants(f, id)) {
          const v2 = migrateV1(doc.design);
          expect(v2.baseId).toBe(id);
          expect(buildDocumentHtml(withSpec(doc, v2), { fonts })).toBe(
            buildDocumentHtml(doc, { fonts }),
          );
          // …and writing the spec back gives the same v1 settings.
          const back = toV1(v2, doc.design);
          expect(back.templateId).toBe(doc.design.templateId);
          expect(back.accent).toBe(doc.design.accent);
          expect(back.fontPair).toBe(doc.design.fontPair);
          expect(back.density).toBe(doc.design.density);
          expect(back.pageSize).toBe(doc.design.pageSize);
        }
    });
});

/** Document text in source order (header, main, side, third), without tags. */
function streamOrder(full: string) {
  // Only the document body (the runtime script also mentions the flow names).
  const html = full.slice(0, full.indexOf('<script>'));
  const at = (marker: string) => html.indexOf(marker);
  return {
    header: at('data-slot="header"'),
    main: at('data-flow="main"'),
    aside: at('data-flow="aside"'),
    third: at('data-flow="third"'),
  };
}

describe('property test: random specs (R6 gate)', () => {
  const r = rng(20261113);
  const N = 5000;
  it(`${N} random specs × fixtures compose into valid, safe documents`, () => {
    for (let i = 0; i < N; i++) {
      const raw = randomSpec(r);
      const doc = withSpec(fixtures[i % fixtures.length]!, raw);
      const html = buildDocumentHtml(doc, { fonts });
      const { spec } = normalise(raw, doc);
      const css = html.slice(
        html.indexOf('<style>', html.indexOf('</style>')),
        html.indexOf('</head>'),
      );
      // No person text and nothing broken in the CSS.
      expect(css).not.toMatch(/undefined|NaN|\[object|<script|url\(/);
      expect(html).not.toMatch(/>undefined<|>NaN<|\[object Object\]/);
      // Text stream order: header, main, side, third.
      const o = streamOrder(html);
      expect(o.header).toBeGreaterThan(-1);
      expect(o.main).toBeGreaterThan(o.header);
      if (o.aside > -1) expect(o.aside).toBeGreaterThan(o.main);
      if (o.third > -1) expect(o.third).toBeGreaterThan(Math.max(o.main, o.aside));
      // The name is in the header, first.
      if (doc.basics.name)
        expect(html.indexOf(doc.basics.name.split(' ')[0]!, o.header)).toBeLessThan(o.main);
      // Hard rules hold after normalise.
      if (!spec.baseId) {
        if (spec.layout.type === 'rails') {
          expect(spec.layout.sideWidthPct).toBeGreaterThanOrEqual(20);
          expect(spec.layout.sideWidthPct).toBeLessThanOrEqual(27);
        } else if (spec.placement.side.length) {
          expect(spec.layout.sideWidthPct).toBeGreaterThanOrEqual(24);
          expect(spec.layout.sideWidthPct).toBeLessThanOrEqual(40);
        }
        expect(spec.type.basePt).toBeGreaterThanOrEqual(9.5);
        expect(['bars', 'dots']).not.toContain(spec.lists.skills.style);
        if (spec.color.mode !== 'duo') expect(spec.color.secondary).toBeUndefined();
      }
    }
  }, 120_000);
});

describe('normalise', () => {
  it('moves everything to one column without a side layout', () => {
    const { spec } = normalise(
      parseSpec({ layout: { type: 'single' }, placement: { side: ['skills'] } }),
    );
    expect(spec.placement.side).toEqual([]);
  });
  it('never shows skill bars without levels, and says why', () => {
    const r = normalise(parseSpec({ lists: { skills: { style: 'bars' } } }));
    expect(r.spec.lists.skills.style).toBe('tags');
    expect(r.unmet.join(' ')).toMatch(/levels/);
  });
  it('moves long sections out of narrow columns', () => {
    const doc = structuredClone(FIXTURES.extreme);
    const r = normalise(
      parseSpec({ layout: { type: 'sidebar-left' }, placement: { side: ['skills', 'languages'] } }),
      doc,
    );
    const skillsChars = JSON.stringify(
      doc.sections.find((s) => s.kind === 'skills')?.items ?? [],
    ).length;
    if (skillsChars > 650) {
      expect(r.spec.placement.side).not.toContain('skills');
      expect(r.unmet.join(' ')).toMatch(/main column/);
    }
  });
  it('clamps column widths for rails and keeps third-column kinds out of the side column', () => {
    const r = normalise(
      parseSpec({
        layout: { type: 'rails', sideWidthPct: 38 },
        placement: { side: ['skills'], third: ['skills', 'awards'] },
      }),
    );
    expect(r.spec.layout.sideWidthPct).toBe(27);
    expect(r.spec.placement.third).toEqual(['awards']);
  });
  it('three columns share the side sections when the right column is empty', () => {
    const r = normalise(
      parseSpec({
        layout: { type: 'rails' },
        placement: { side: ['skills', 'languages', 'awards'] },
      }),
    );
    expect(r.spec.placement.side).toEqual(['skills', 'languages']);
    expect(r.spec.placement.third).toEqual(['awards']);
  });
  it('ATS-safe makes one plain column with standard headings and no art', () => {
    const r = normalise(parseSpec({ ...catalogueSpec('atelier'), atsSafe: true }));
    expect(r.spec.baseId).toBeUndefined();
    expect(r.spec.layout.type).toBe('single');
    expect(r.spec.decor.kind).toBe('none');
    expect(r.spec.header.photo.show).toBe(false);
    expect(r.spec.icons.sections).toBe(false);
  });
  it('drops signature artwork from detached specs and a second colour outside duo mode', () => {
    const r = normalise(
      parseSpec({ decor: { kind: 'signature:vivid' }, color: { secondary: '#123456' } }),
    );
    expect(r.spec.decor.kind).toBe('none');
    expect(r.spec.color.secondary).toBeUndefined();
  });
});

describe('composer', () => {
  it('renders every enum value of every field', () => {
    const sweep = enumSweep();
    expect(sweep.length).toBeGreaterThan(80);
    for (const { label, spec } of sweep)
      for (const f of [FIXTURES.engineer, withPhoto(FIXTURES.teacher, PHOTO_FOR.teacher)]) {
        const html = buildDocumentHtml(withSpec(f, spec), { fonts });
        expect(html, label).toContain('data-cv-source');
        expect(html, label).toContain(f.basics.name.split(' ')[0]);
      }
  });
  it('rails put side and third columns in their own flows', () => {
    const spec = parseSpec({
      layout: { type: 'rails' },
      placement: { side: ['skills'], third: ['languages', 'certifications'] },
    });
    const html = buildDocumentHtml(withSpec(FIXTURES.teacher, spec), { fonts });
    const third = html.slice(html.indexOf('data-flow="third"'), html.indexOf('<script>'));
    expect(third).toContain('k-languages');
    expect(html.indexOf('data-flow="aside"')).toBeLessThan(html.indexOf('data-flow="third"'));
  });
  it('keeps columns on every page when asked', () => {
    const html = buildDocumentHtml(
      withSpec(
        FIXTURES.extreme,
        parseSpec({
          layout: { type: 'sidebar-left', continuation: 'keep-columns' },
          placement: { side: ['skills'] },
        }),
      ),
      { fonts },
    );
    expect(html).toMatch(/<html[^>]*data-keep-columns/);
  });
  it('an attached spec uses its catalogue design; a detached one is composed', () => {
    const doc = FIXTURES.driver;
    expect(documentDesign(withSpec(doc, catalogueSpec('vivid'))).template.id).toBe('vivid');
    const detached = { ...catalogueSpec('vivid'), baseId: undefined };
    expect(documentDesign(withSpec(doc, detached)).template.id).toBe('custom');
  });
  it('formats dates in the chosen style', () => {
    expect(formatDates('Mar 2021 – Present', 'YYYY')).toBe('2021 – Present');
    expect(formatDates('Mar 2021 – Nov 2023', 'MM/YYYY')).toBe('03/2021 – 11/2023');
    expect(formatDates('2015 – 2018', 'MM/YYYY')).toBe('2015 – 2018');
  });
  it('person text never reaches the CSS', () => {
    const doc = structuredClone(FIXTURES.driver);
    doc.basics.name = 'Evil </style><script>alert(1)</script>';
    const html = buildDocumentHtml(withSpec(doc, parseSpec({ header: { style: 'band' } })), {
      fonts,
    });
    expect(html).not.toContain('<script>alert');
  });
});
