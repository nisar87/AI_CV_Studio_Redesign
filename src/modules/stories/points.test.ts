import { describe, expect, it } from 'vitest';
import { driver } from '@/modules/resume/fixtures';
import type { ResumeDocument } from '@/modules/resume/schema';
import { storyPoints } from './points';

describe('story points', () => {
  it('offers job points first and never personal details or skill lists', () => {
    const doc = structuredClone(driver) as ResumeDocument;
    // An imported CV: "Core strengths" and "Personal details" as custom sections before the jobs.
    doc.sections.unshift(
      {
        id: 'strengths',
        kind: 'custom',
        title: 'Core strengths',
        hidden: false,
        items: [
          {
            id: 'c1',
            title: '',
            subtitle: '',
            bullets: ['Route planning | Customer care | Vehicle checks | Safety'],
          },
        ],
      } as never,
      {
        id: 'personal',
        kind: 'custom',
        title: 'Personal details',
        hidden: false,
        items: [
          {
            id: 'p1',
            title: '',
            subtitle: '',
            bullets: [
              'Nationality: Pakistani',
              'Date of Birth: 09.08.1987',
              'Phone / WhatsApp: +92 300 0000000',
              'Raised money for the local food bank by organising a sponsored drive',
            ],
          },
        ],
      } as never,
    );
    const pts = storyPoints(doc);
    expect(pts[0]!.id).toMatch(/^J1\.B/);
    const texts = pts.map((p) => p.text).join('\n');
    expect(texts).not.toMatch(/Nationality|Date of Birth|WhatsApp|Route planning \|/);
    // A real achievement in another section is still offered, after the jobs.
    expect(pts.at(-1)!.text).toMatch(/food bank/);
  });
});
