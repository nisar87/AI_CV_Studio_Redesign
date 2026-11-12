import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resumeDocument, type ResumeDocument } from '@/modules/resume/schema';
import { extractLines, htmlToLines, ImportError, sniff } from './extract';
import { findDates, headingOf, mergeWrapped, parseCv, toPartial } from './parse';

const fixture = (f: string) => new Uint8Array(readFileSync(join(__dirname, '__fixtures__', f)));
const items = (d: ResumeDocument, kind: string) =>
  d.sections.filter((s) => s.kind === kind).flatMap((s) => s.items as Record<string, unknown>[]);

describe('dates', () => {
  it('reads common date styles', () => {
    expect(toPartial('Sep 2020')).toBe('2020-09');
    expect(toPartial('September, 2020')).toBe('2020-09');
    expect(toPartial('03/2018')).toBe('2018-03');
    expect(toPartial('2019')).toBe('2019');
    expect(findDates('Staff Nurse Mar 2021 – Present')).toMatchObject({
      start: '2021-03',
      end: '',
      current: true,
      rest: 'Staff Nurse',
    });
    expect(findDates('MBA | University of the Punjab | 2016 - 2018')).toMatchObject({
      start: '2016',
      end: '2018',
      rest: 'MBA | University of the Punjab',
    });
    expect(findDates('Led a team')).toBeNull();
  });
});

describe('headings', () => {
  it('recognises plain, capitalised, letter-spaced and punctuated headings', () => {
    expect(headingOf('WORK EXPERIENCE')?.kind).toBe('experience');
    expect(headingOf('Employment History:')?.kind).toBe('experience');
    expect(headingOf('Profile.')?.kind).toBe('summary');
    expect(headingOf('Awards & Achievements')?.kind).toBe('awards');
    expect(headingOf('Managed a team of five people.')).toBeNull();
  });
  it('joins a letter-spaced heading wrapped over two lines', () => {
    const { doc } = parseCv([
      'Amina Yusuf',
      'WO R K',
      'H I S TO RY',
      'Nurse Jan 2020 – Present',
      'Ward A',
    ]);
    expect(items(doc, 'experience')).toHaveLength(1);
  });
});

describe('wrapping', () => {
  it('joins lines a PDF wrapped mid-sentence and strips bullet symbols', () => {
    expect(
      mergeWrapped([
        '• Lead maths across the school: planning, staff training',
        'and assessment',
        '• Next',
      ]).map((l) => l.text),
    ).toEqual(['Lead maths across the school: planning, staff training and assessment', 'Next']);
  });
});

describe('parseCv', () => {
  it('never drops words: unknown header lines go to "Other"', () => {
    const { doc, report } = parseCv([
      'Jane Doe',
      'jane@example.com',
      'Driving licence holder',
      'Skills',
      'Excel, Word',
    ]);
    expect(report.unplaced).toBe(0);
    expect(doc.basics.headline).toBe('Driving licence holder');
    const { doc: d2, report: r2 } = parseCv(['Jane Doe', 'Line one', 'Line two', 'Line three']);
    expect(d2.basics.headline).toBe('Line one');
    expect(r2.unplaced).toBe(2);
    expect(items(d2, 'custom')[0]).toMatchObject({ bullets: ['Line two', 'Line three'] });
  });

  it('handles "Role / Company / date" and "Title / date / School" layouts', () => {
    const { doc } = parseCv([
      'Ali Khan',
      'Experience',
      'Cashier',
      'Metro, Lahore',
      'Jan 2020 – Present',
      '• Served customers',
      'Stock Assistant',
      'Imtiaz, Lahore',
      'Jun 2018 – Dec 2019',
      '• Filled shelves',
      'Education',
      'Intermediate (FA)',
      '2016 – 2018',
      'Govt College Lahore',
      'Matric',
      '2014 – 2016',
      'City School',
    ]);
    expect(items(doc, 'experience')).toMatchObject([
      {
        role: 'Cashier',
        organization: 'Metro',
        location: 'Lahore',
        current: true,
        bullets: ['Served customers'],
      },
      { role: 'Stock Assistant', organization: 'Imtiaz', start: '2018-06', end: '2019-12' },
    ]);
    expect(items(doc, 'education')).toMatchObject([
      {
        qualification: 'Intermediate (FA)',
        institution: 'Govt College Lahore',
        start: '2016',
        end: '2018',
      },
      { qualification: 'Matric', institution: 'City School', start: '2014', end: '2016' },
    ]);
  });

  it('removes a monogram and finds a name split over two lines', () => {
    expect(
      parseCv(['GM', 'Grace Mensah', 'Teacher', 'grace@example.com']).doc.basics,
    ).toMatchObject({
      name: 'Grace Mensah',
      headline: 'Teacher',
    });
    expect(parseCv(['Imran', 'Qureshi', 'Driver']).doc.basics.name).toBe('Imran Qureshi');
    expect(parseCv(['AR · Ali Raza', '0300 1234567']).doc.basics).toMatchObject({
      name: 'Ali Raza',
      phone: '0300 1234567',
    });
  });

  it('reads skills with labels, and languages with levels', () => {
    const { doc } = parseCv([
      'Dan',
      'Skills',
      'Languages',
      'TypeScript · Go',
      'Platforms',
      'AWS · Redis',
      'Languages',
      'English (Fluent), Urdu - Native',
    ]);
    expect(items(doc, 'skills')).toMatchObject([
      { label: 'Languages', keywords: ['TypeScript', 'Go'] },
      { label: 'Platforms', keywords: ['AWS', 'Redis'] },
    ]);
    expect(items(doc, 'languages')).toMatchObject([
      { language: 'English', fluency: 'Fluent' },
      { language: 'Urdu', fluency: 'Native' },
    ]);
  });
});

describe('real files', () => {
  it('rejects unsupported and old Word files by their bytes', async () => {
    expect(sniff(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toBe('doc');
    await expect(extractLines(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).rejects.toBeInstanceOf(
      ImportError,
    );
  });

  it('reads list items from Word HTML as bullets', () => {
    expect(
      htmlToLines('<h1>Skills</h1><ul><li>Excel &amp; Word</li></ul>').filter(Boolean),
    ).toEqual(['Skills', '• Excel & Word']);
  });

  for (const file of ['word-sales.docx', 'word-sales.pdf']) {
    it(`imports a typical Word CV (${file})`, async () => {
      const { lines } = await extractLines(fixture(file), file);
      const { doc, report } = parseCv(lines);
      expect(resumeDocument.safeParse(doc).success).toBe(true);
      expect(doc.basics).toMatchObject({
        name: 'Ahmed Raza Khan',
        email: 'ahmed.raza@example.com',
        phone: '+92 300 1234567',
        location: 'Lahore, Pakistan',
      });
      expect(doc.basics.links[0]).toMatchObject({
        label: 'LinkedIn',
        url: 'linkedin.com/in/ahmedraza',
      });
      expect(items(doc, 'experience')).toMatchObject([
        {
          role: 'Senior Sales Officer',
          organization: 'Nestlé Pakistan',
          location: 'Lahore',
          start: '2021-01',
          current: true,
          bullets: [
            'Managed 120 retail outlets across Lahore Cantt and DHA',
            'Increased monthly sales by 18% in 2023',
            'Trained four new sales officers',
          ],
        },
        { role: 'Sales Officer', organization: 'ABC Traders', start: '2018-03', end: '2020-12' },
      ]);
      expect(items(doc, 'education')).toHaveLength(2);
      expect(items(doc, 'skills')[0]?.keywords).toHaveLength(5);
      expect(items(doc, 'languages')).toHaveLength(3);
      expect(items(doc, 'certifications')[0]).toMatchObject({
        name: 'Certified Sales Professional',
        issuer: 'NASP',
        date: '2022',
      });
      expect(report.unplaced).toBe(0);
    });
  }

  it('imports a two-page, two-column PDF in reading order', async () => {
    const { lines } = await extractLines(fixture('two-column.pdf'), 'two-column.pdf');
    const { doc } = parseCv(lines);
    expect(doc.basics.name).toBe('Daniel Okafor');
    // Jobs from page 2 (printed after the side column) rejoin the work history.
    expect(items(doc, 'experience').map((e) => e.organization)).toEqual([
      'Northwind Payments',
      'Parcelly',
      'Ledgerline',
      'Brightwave Digital',
      'Ashdown IT Services',
      'Leeds City Council',
    ]);
  });
});
