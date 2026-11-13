import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@/modules/resume/fixtures';
import { SPEC_DESIGN_IDS } from '@/modules/resume/ids';
import { ACCENT_PALETTE } from '@/modules/templates/design';
import { contrast } from '@/modules/templates/color';
import { designSpec } from './catalogue';
import { contrastPairs } from './compose';
import { normalise } from './normalise';
import { enumSweep, randomSpec, rng } from './samples';
import { parseSpec, type DesignSpecV2 } from './spec';

/** Catalogue gate §8.3: every text/background pair at least 4.5:1, for any colour a person picks. */
const ACCENTS = [
  ...ACCENT_PALETTE.map((c) => c.hex),
  '#ffff00',
  '#00ffff',
  '#00ff00',
  '#ff8800',
  '#ff00ff',
  '#888888',
  '#000000',
  '#ffffff',
];

function failures(spec: DesignSpecV2, label: string): string[] {
  const out: string[] = [];
  const { spec: s } = normalise(spec, FIXTURES.teacher);
  for (const p of contrastPairs(s)) {
    const r = contrast(p.fg, p.bg);
    if (r < 4.5) out.push(`${label}: ${p.what} ${p.fg} on ${p.bg} = ${r.toFixed(2)}`);
  }
  return out;
}

describe('contrast on resolved colours', () => {
  it('every catalogue spec design, with every accent', () => {
    const bad: string[] = [];
    for (const id of SPEC_DESIGN_IDS)
      for (const accent of ACCENTS) {
        const s = designSpec(id, FIXTURES.teacher.design);
        bad.push(...failures({ ...s, color: { ...s.color, accent } }, `${id} ${accent}`));
      }
    expect(bad).toEqual([]);
  });

  it('every value of every field, and random specs, with extreme accents', () => {
    const bad: string[] = [];
    for (const { label, spec } of enumSweep())
      for (const accent of ['#ffff00', '#00ffff', '#1f4e8c'])
        bad.push(...failures({ ...spec, color: { ...spec.color, accent } }, `${label} ${accent}`));
    const r = rng(11);
    for (let i = 0; i < 500; i++) bad.push(...failures(randomSpec(r), `random ${i}`));
    const duo = parseSpec({ color: { mode: 'duo', accent: '#1f4e8c', secondary: '#ffcc00' } });
    bad.push(...failures(duo, 'duo with a light second colour'));
    expect(bad.slice(0, 20)).toEqual([]);
  });
});
