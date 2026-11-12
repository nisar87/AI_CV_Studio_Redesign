import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@/modules/resume/fixtures';
import type { ResumeDocument } from '@/modules/resume/schema';
import { repeatsContact, tidyImport } from './tidy';

const other = (id: string, bullets: string[]) => ({
  id,
  kind: 'custom' as const,
  title: 'Other',
  hidden: false,
  items: [{ id: `${id}i`, title: '', subtitle: '', date: '', bullets }],
});

describe('tidyImport (real CV case, 2026-11-13)', () => {
  const base: ResumeDocument = {
    ...structuredClone(FIXTURES.engineer),
    basics: {
      ...FIXTURES.engineer.basics,
      phone: '+92 3218554745',
      email: 'nisar_87@hotmail.com',
      location: 'Fateh Jang / Islamabad, Pakistan',
      links: [{ id: 'l', label: 'LinkedIn', url: 'linkedin.com/in/nisarse' }],
    },
  };
  const doc: ResumeDocument = {
    ...base,
    sections: [
      other('o1', [
        'Enterprise backend systems | SQL Server optimization | Telecom workflows | Automation',
        'Nationality: Pakistani',
        'Date of Birth: 09.08.1987',
      ]),
      ...base.sections,
      other('o2', ['Phone / WhatsApp: +92 3218554745']),
    ],
  };

  it('moves Other to the end, splits personal details, drops repeated contact lines', () => {
    const t = tidyImport(doc);
    const titles = t.sections.map((s) => s.title);
    expect(titles.slice(-2)).toEqual(['Personal details', 'Other']);
    expect(titles.filter((x) => x === 'Other')).toHaveLength(1);
    const bullets = (title: string) =>
      (t.sections.find((s) => s.title === title)!.items[0] as { bullets: string[] }).bullets;
    expect(bullets('Personal details')).toEqual([
      'Nationality: Pakistani',
      'Date of Birth: 09.08.1987',
    ]);
    expect(bullets('Other')).toEqual([
      'Enterprise backend systems | SQL Server optimization | Telecom workflows | Automation',
    ]);
    expect(t.sections[0]!.kind).toBe(base.sections[0]!.kind);
  });

  it('only drops a contact line when its value is already in the header', () => {
    expect(repeatsContact('Email: nisar_87@hotmail.com', doc)).toBe(true);
    expect(repeatsContact('LinkedIn: linkedin.com/in/nisarse', doc)).toBe(true);
    expect(repeatsContact('Phone: +92 300 1111111', doc)).toBe(false);
    expect(repeatsContact('Email: other@example.com', doc)).toBe(false);
    expect(repeatsContact('Nationality: Pakistani', doc)).toBe(false);
  });

  it('leaves documents without Other untouched', () => {
    expect(tidyImport(base)).toBe(base);
  });
});
