import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig, withAllDesigns } from '@/modules/billing/config';
import { FIXTURES } from '@/modules/resume/fixtures';
import { DESIGN_IDS, SPEC_DESIGN_IDS, TEMPLATE_IDS } from '@/modules/resume/ids';
import { ops } from '@/modules/resume/ops';
import { buildDocumentHtml } from '@/modules/templates/build-document';
import { currentDesignId, designSpec, tierDesignId } from './catalogue';
import { DESIGNS, DESIGN_META, FAMILIES, SPEC_DESIGNS } from './designs';
import { normalise } from './normalise';
import { parseSpec } from './spec';

const fonts = { kind: 'url' as const, baseUrl: 'https://cvstudio.test' };

describe('R7 catalogue', () => {
  it('has 32 designs: 8 families of 4, every id once', () => {
    expect(DESIGNS.map((d) => d.id).sort()).toEqual([...DESIGN_IDS].sort());
    for (const f of FAMILIES) expect(DESIGNS.filter((d) => d.family === f)).toHaveLength(4);
    for (const id of SPEC_DESIGN_IDS) expect(SPEC_DESIGNS[id]).toBeDefined();
  });

  it('designs in a family differ in something visible, never only in colour', () => {
    const look = (id: (typeof DESIGN_IDS)[number]) => {
      const s = designSpec(id, FIXTURES.teacher.design);
      return [s.layout.type, s.header.style, s.headings.style, s.decor.kind, s.baseId].join('|');
    };
    for (const f of FAMILIES) {
      const looks = DESIGNS.filter((d) => d.family === f).map((d) => look(d.id));
      expect(new Set(looks).size, f).toBe(4);
    }
  });

  it.each(SPEC_DESIGN_IDS)('%s composes for every fixture with its own spec', (id) => {
    for (const doc of Object.values(FIXTURES)) {
      const d = ops.useDesign(doc, id);
      expect(d.design.v2?.designId).toBe(id);
      expect(currentDesignId(d.design)).toBe(id);
      const html = buildDocumentHtml(d, { fonts });
      expect(html).toContain('data-template="custom"');
      expect(html).toContain(doc.basics.name || '<html');
    }
  });

  it('keeps the person’s colour and spacing; the font is the design’s own when it has one', () => {
    const start = ops.setDesign(FIXTURES.teacher, { accent: '#7a1f5c', density: 'compact' });
    const d = ops.useDesign(start, 'regent');
    expect(d.design.v2?.color.accent).toBe('#7a1f5c');
    expect(d.design.v2?.spacing.density).toBe('compact');
    expect(d.design.fontPair).toBe(DESIGN_META.regent.fontPair);
    expect(d.design.templateId).toBe('heritage'); // v1 readers get the family's crafted design
  });

  it('stays the same design while only overridable choices change', () => {
    let d = ops.useDesign(FIXTURES.teacher, 'summit');
    d = ops.setDesign(d, { accent: '#0b6e4f', pageSize: 'Letter', density: 'airy' });
    expect(currentDesignId(d.design)).toBe('summit');
  });

  it('picking a crafted design from a spec design re-attaches, even with the same v1 id', () => {
    const linea = ops.useDesign(FIXTURES.teacher, 'linea');
    expect(linea.design.templateId).toBe('clarity');
    const back = ops.useDesign(linea, 'clarity');
    expect(back.design.v2?.baseId).toBe('clarity');
    expect(back.design.v2?.designId).toBeUndefined();
    expect(currentDesignId(back.design)).toBe('clarity');
  });

  it('a crafted design renders exactly as before when picked through the catalogue', () => {
    for (const id of TEMPLATE_IDS) {
      const viaCatalogue = ops.useDesign(FIXTURES.engineer, id);
      const viaV1 = ops.setDesign(FIXTURES.engineer, {
        templateId: id,
        ...(DESIGN_META[id].fontPair ? { fontPair: DESIGN_META[id].fontPair } : {}),
      });
      expect(buildDocumentHtml(viaCatalogue, { fonts })).toBe(buildDocumentHtml(viaV1, { fonts }));
    }
  });

  it('decides the download tier: catalogue design, its ATS-safe version, or custom', () => {
    const spark = ops.useDesign(FIXTURES.teacher, 'spark');
    expect(tierDesignId(spark.design)).toBe('spark');
    const custom = parseSpec({ ...spark.design.v2, designId: undefined, origin: 'spark' });
    expect(tierDesignId(ops.setSpec(spark, custom).design)).toBeNull();
    const ats = ops.setSpec(spark, { ...custom, atsSafe: true });
    expect(tierDesignId(ats.design)).toBe('spark');
    expect(tierDesignId(FIXTURES.teacher.design)).toBe(FIXTURES.teacher.design.templateId);
  });

  it('new designs are hidden and Premium in a stored config from before R7', () => {
    const old = {
      ...DEFAULT_CONFIG,
      designs: TEMPLATE_IDS.map((id) => ({ id, enabled: true, tier: 'free', isNew: false })),
    };
    const cfg = parseConfig(old);
    expect(cfg.designs).toHaveLength(32);
    expect(cfg.designs.find((d) => d.id === 'mosaic')).toEqual({
      id: 'mosaic',
      enabled: false,
      tier: 'premium',
      isNew: true,
    });
    expect(cfg.designs.find((d) => d.id === 'clarity')?.enabled).toBe(true);
    expect(withAllDesigns(cfg)).toBe(cfg);
  });

  it('the catalogue specs need no corrections from the hard rules', () => {
    for (const id of SPEC_DESIGN_IDS) {
      const spec = designSpec(id, FIXTURES.teacher.design);
      const n = normalise(spec, FIXTURES.teacher);
      expect(n.spec.layout, id).toEqual(spec.layout);
      expect(n.spec.header.photo.position, id).toBe(spec.header.photo.position);
    }
  });
});
