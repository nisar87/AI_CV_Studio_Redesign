import { describe, expect, it } from 'vitest';
import { resumeDocument } from '@/modules/resume/schema';
import { parseCv } from './parse';
import {
  checkFidelity,
  docToStructure,
  structureToDoc,
  uncoveredLines,
  words,
  type Structure,
} from './structure';

const SOURCE = [
  'Ahmed Raza Khan',
  'Lahore | +92 300 1234567 | ahmed.raza@example.com',
  'WORK EXPERIENCE',
  'Senior Sales Officer',
  'Nestlé Pakistan, Lahore',
  'January 2021 – Present',
  '• Managed 120 retail outlets across Lahore Cantt and DHA',
  'HOBBIES',
  'Cricket and reading Urdu poetry',
];

const good = (): Structure => ({
  name: 'Ahmed Raza Khan',
  headline: '',
  email: 'ahmed.raza@example.com',
  phone: '+92 300 1234567',
  location: 'Lahore',
  links: [],
  summary: '',
  sections: [
    {
      kind: 'experience',
      title: 'Work experience',
      entries: [
        {
          title: 'Senior Sales Officer',
          subtitle: 'Nestlé Pakistan',
          place: 'Lahore',
          start: '2021-01',
          end: '',
          current: true,
          lines: ['Managed 120 retail outlets across Lahore Cantt and DHA'],
        },
      ],
    },
  ],
});

describe('AI import checks', () => {
  it('normalises words (accents, apostrophes, hyphens)', () => {
    expect(words("Nestlé St Mary's customer-facing")).toEqual([
      'nestle',
      'st',
      'marys',
      'customer',
      'facing',
    ]);
  });

  it('accepts a faithful copy', () => {
    expect(checkFidelity(good(), SOURCE)).toEqual({ ok: true, invented: [] });
  });

  it('rejects anything the AI added or reworded', () => {
    const s = good();
    s.sections[0]!.entries[0]!.lines = ['Managed 150 retail outlets, boosting revenue'];
    s.headline = 'Results-driven Sales Leader';
    const f = checkFidelity(s, SOURCE);
    expect(f.ok).toBe(false);
    expect(f.invented).toHaveLength(2);
    expect(f.invented.join(' ')).toMatch(/150|boosting|revenue/);
  });

  it('finds source lines the AI left out, and they are kept in "Other"', () => {
    const missing = uncoveredLines(good(), SOURCE);
    expect(missing).toEqual(['Cricket and reading Urdu poetry']);
    const { doc, report } = structureToDoc(good(), missing);
    expect(report.unplaced).toBe(1);
    expect(doc.sections.at(-1)).toMatchObject({ kind: 'custom', title: 'Other' });
  });

  it('maps the generic shape to a valid CV and back without loss', () => {
    const rules = parseCv(SOURCE).doc;
    const round = structureToDoc(docToStructure(rules), []).doc;
    expect(resumeDocument.safeParse(round).success).toBe(true);
    expect(round.basics).toMatchObject({
      name: 'Ahmed Raza Khan',
      email: 'ahmed.raza@example.com',
    });
    expect(round.sections.find((s) => s.kind === 'experience')?.items[0]).toMatchObject({
      role: 'Senior Sales Officer',
      organization: 'Nestlé Pakistan',
      current: true,
    });
  });
});
