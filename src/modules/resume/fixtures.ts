/**
 * Realistic fixture CVs spanning professions, lengths and edge cases.
 * Used by tests, the template gallery and visual QA. All people and companies are fictional.
 */
import { SAMPLE_PHOTOS } from './fixture-photos';
import { getPreset } from './presets';
import type { PresetId } from './professions';
import { designSpec, type ResumeDocument, type Section } from './schema';

let seq = 0;
const id = (p: string) => `${p}${++seq}`;

type SectionInput = {
  [K in Section['kind']]: {
    kind: K;
    title?: string;
    items: Omit<Extract<Section, { kind: K }>['items'][number], 'id'>[];
  };
}[Section['kind']];

function build(
  key: string,
  presetId: PresetId,
  basics: Partial<Omit<ResumeDocument['basics'], 'links'>> & {
    links?: { label: string; url: string }[];
  },
  sections: SectionInput[],
): ResumeDocument {
  const preset = getPreset(presetId);
  return {
    schemaVersion: 1,
    id: `fixture-${key}`,
    title: `${key} fixture`,
    presetId,
    locale: 'en-GB',
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-01T09:00:00.000Z',
    basics: {
      name: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      summary: '',
      photo: '',
      ...basics,
      links: (basics.links ?? []).map((l) => ({ ...l, id: id('l') })),
    },
    sections: sections.map(
      (s) =>
        ({
          id: id('s'),
          kind: s.kind,
          title:
            s.title ??
            preset.sections.find((p) => p.kind === s.kind)?.title ??
            defaultTitle(s.kind),
          hidden: false,
          items: s.items.map((it) => ({ ...it, id: id('i') })),
        }) as Section,
    ),
    design: designSpec.parse({ ...preset.design }),
  };
}

function defaultTitle(kind: Section['kind']): string {
  return (
    (
      {
        experience: 'Work history',
        education: 'Education',
        skills: 'Skills',
        languages: 'Languages',
        certifications: 'Certifications',
        licences: 'Licences',
        projects: 'Projects',
        volunteering: 'Volunteering',
        awards: 'Awards',
        custom: 'More',
      } as Partial<Record<Section['kind'], string>>
    )[kind] ?? kind
  );
}

const exp = (
  role: string,
  organization: string,
  location: string,
  start: string,
  end: string,
  bullets: string[],
  current = false,
) => ({ role, organization, location, start, end, current, bullets });

export const driver = build(
  'driver',
  'driver',
  {
    name: 'Imran Qureshi',
    headline: 'Multi-drop Delivery Driver',
    email: 'imran.qureshi@example.com',
    phone: '07700 900123',
    location: 'Leicester',
    summary:
      'Reliable delivery driver with nine years of safe, on-time multi-drop work across the East Midlands. Clean licence, calm with customers and quick to learn new routes and handheld systems.',
  },
  [
    {
      kind: 'experience',
      items: [
        exp(
          'Multi-drop Van Driver',
          'Swift Logistics',
          'Leicester',
          '2019-04',
          '',
          [
            'Deliver around 120 parcels a day across three postcode areas',
            'Plan routes each morning to meet timed delivery slots',
            'Complete daily vehicle checks and keep the van clean and safe',
          ],
          true,
        ),
        exp('Courier Driver', 'CityLink Couriers', 'Nottingham', '2016-02', '2019-03', [
          'Same-day deliveries for local businesses and pharmacies',
          'Collected signatures and payments using a handheld scanner',
        ]),
        exp(
          'Warehouse Operative',
          'Midlands Distribution Centre',
          'Leicester',
          '2014-06',
          '2016-01',
          ['Picked and packed orders and loaded vans for morning dispatch'],
        ),
      ],
    },
    {
      kind: 'licences',
      items: [
        {
          name: 'Full UK driving licence — categories B and C1',
          issuer: 'DVLA',
          date: '',
          detail: 'Clean, no points',
        },
        { name: 'Driver CPC', issuer: '', date: '2022', detail: '' },
      ],
    },
    {
      kind: 'skills',
      items: [
        {
          label: '',
          keywords: [
            'Safe driving',
            'Route planning',
            'Time management',
            'Customer service',
            'Vehicle checks',
            'Handheld scanners',
          ],
        },
      ],
    },
    {
      kind: 'education',
      items: [
        {
          qualification: 'GCSEs including English and Maths',
          institution: 'Beaumont Leys School',
          location: 'Leicester',
          start: '',
          end: '2013',
          details: [],
        },
      ],
    },
  ],
);

export const teacher = build(
  'teacher',
  'teacher',
  {
    name: 'Grace Mensah',
    headline: 'Primary School Teacher',
    email: 'grace.mensah@example.com',
    phone: '07700 900456',
    location: 'Manchester',
    links: [{ label: 'LinkedIn', url: 'linkedin.com/in/gracemensah' }],
    summary:
      'Caring and organised primary teacher with eight years of experience in Key Stage 2. I create calm, structured classrooms where every child can make progress, and I work closely with parents and support staff. Maths lead with a track record of raising attainment.',
  },
  [
    {
      kind: 'experience',
      items: [
        exp(
          'Year 5 Class Teacher and Maths Lead',
          'Oakfield Primary School',
          'Manchester',
          '2020-09',
          '',
          [
            'Teach a class of 30 pupils across the full Key Stage 2 curriculum',
            'Lead maths across the school: planning, staff training and assessment',
            'Introduced daily arithmetic practice; the share of pupils meeting the expected standard rose from 68% to 81% in two years',
            'Mentor two early-career teachers each year',
          ],
          true,
        ),
        exp(
          'Year 4 Class Teacher',
          'St Mary’s CE Primary School',
          'Stockport',
          '2017-09',
          '2020-07',
          [
            'Planned and taught engaging lessons for a mixed-ability class of 28',
            'Worked with the SENCO to adapt lessons for pupils with additional needs',
            'Ran the after-school gardening club',
          ],
        ),
        exp('Teaching Assistant', 'Brookside Primary School', 'Manchester', '2015-09', '2016-07', [
          'Supported small reading groups and one-to-one interventions',
        ]),
      ],
    },
    {
      kind: 'education',
      items: [
        {
          qualification: 'PGCE Primary Education with QTS',
          institution: 'Manchester Metropolitan University',
          location: 'Manchester',
          start: '2016',
          end: '2017',
          details: [],
        },
        {
          qualification: 'BA (Hons) Education Studies, 2:1',
          institution: 'University of Leeds',
          location: 'Leeds',
          start: '2012',
          end: '2015',
          details: [],
        },
      ],
    },
    {
      kind: 'certifications',
      items: [
        {
          name: 'Qualified Teacher Status (QTS)',
          issuer: 'Department for Education',
          date: '2017',
          detail: '',
        },
        { name: 'Designated Safeguarding Lead training', issuer: '', date: '2023', detail: '' },
        { name: 'Paediatric First Aid', issuer: 'St John Ambulance', date: '2024', detail: '' },
      ],
    },
    {
      kind: 'skills',
      items: [
        {
          label: '',
          keywords: [
            'Lesson planning',
            'Classroom management',
            'Differentiation',
            'Safeguarding',
            'Assessment for learning',
            'Parent communication',
            'Google Classroom',
          ],
        },
      ],
    },
    {
      kind: 'languages',
      items: [
        { language: 'English', fluency: 'Native' },
        { language: 'Twi', fluency: 'Fluent' },
      ],
    },
  ],
);

export const nurse = build(
  'nurse',
  'healthcare',
  {
    name: 'Amina Yusuf',
    headline: 'Registered Nurse — Acute Medicine',
    email: 'amina.yusuf@example.com',
    phone: '+44 7700 900789',
    location: 'Birmingham',
    summary:
      'Registered adult nurse with five years on busy acute medical wards. Calm under pressure, thorough with observations and documentation, and committed to compassionate, patient-centred care.',
  },
  [
    {
      kind: 'experience',
      items: [
        exp(
          'Staff Nurse (Band 5)',
          'Queen Elizabeth Hospital',
          'Birmingham',
          '2021-03',
          '',
          [
            'Care for up to 8 patients per shift on a 30-bed acute medical ward',
            'Administer medicines, including IV therapy, and monitor for side effects',
            'Coordinate discharges with families, social workers and community teams',
            'Act as shift coordinator when the ward manager is off duty',
          ],
          true,
        ),
        exp('Staff Nurse', 'Heartlands Hospital', 'Birmingham', '2019-09', '2021-02', [
          'Rotated through respiratory and elderly care wards during the pandemic',
          'Supported student nurses on placement as a practice supervisor',
        ]),
      ],
    },
    {
      kind: 'certifications',
      title: 'Registration & certifications',
      items: [
        {
          name: 'NMC registered nurse (Adult)',
          issuer: 'Nursing and Midwifery Council',
          date: '2019',
          detail: 'PIN available on request',
        },
        {
          name: 'Immediate Life Support (ILS)',
          issuer: 'Resuscitation Council UK',
          date: '2025',
          detail: '',
        },
        { name: 'IV therapy and cannulation', issuer: '', date: '2021', detail: '' },
      ],
    },
    {
      kind: 'education',
      items: [
        {
          qualification: 'BSc (Hons) Adult Nursing',
          institution: 'Birmingham City University',
          location: 'Birmingham',
          start: '2016',
          end: '2019',
          details: [],
        },
      ],
    },
    {
      kind: 'skills',
      items: [
        {
          label: '',
          keywords: [
            'Patient assessment',
            'Medication administration',
            'IV therapy',
            'Wound care',
            'NEWS2 observations',
            'Infection control',
            'Electronic patient records',
          ],
        },
      ],
    },
    {
      kind: 'languages',
      items: [
        { language: 'English', fluency: 'Fluent' },
        { language: 'Hausa', fluency: 'Native' },
        { language: 'Arabic', fluency: 'Basic' },
      ],
    },
  ],
);

export const graduate = build(
  'graduate',
  'student',
  {
    name: 'Sana Iqbal',
    headline: 'Business Management Graduate',
    email: 'sana.iqbal@example.com',
    phone: '07700 900321',
    location: 'Bristol',
    links: [{ label: 'Portfolio', url: 'sanaiqbal.example.com' }],
    summary:
      'Recent business graduate looking for a graduate role in marketing or operations. Experienced in customer-facing work and team projects, with a final-year project on local retail and social media.',
  },
  [
    {
      kind: 'education',
      items: [
        {
          qualification: 'BA (Hons) Business Management — First Class',
          institution: 'University of the West of England',
          location: 'Bristol',
          start: '2023',
          end: '2026',
          details: [
            'Dissertation: How independent shops in Bristol use Instagram to reach younger customers',
            'Modules: Marketing, Operations Management, Data Analysis',
          ],
        },
        {
          qualification: 'A levels: Business (A), Psychology (B), English (B)',
          institution: 'Cotham School',
          location: 'Bristol',
          start: '2021',
          end: '2023',
          details: [],
        },
      ],
    },
    {
      kind: 'projects',
      items: [
        {
          name: 'Pop-up market stall',
          role: 'Team leader',
          link: '',
          start: '2025-03',
          end: '2025-05',
          bullets: [
            'Led a team of five to plan and run a student market stall',
            'Managed a £200 budget and tracked sales in a spreadsheet',
          ],
        },
      ],
    },
    {
      kind: 'experience',
      title: 'Work experience',
      items: [
        exp('Retail Assistant (part-time)', 'Harbourside Books', 'Bristol', '2023-10', '2026-06', [
          'Served customers, ran the till and helped with weekly stock deliveries',
          'Set up the shop’s first Instagram account and posted new arrivals weekly',
        ]),
      ],
    },
    {
      kind: 'skills',
      items: [
        {
          label: '',
          keywords: [
            'Microsoft Excel',
            'Canva',
            'Social media',
            'Customer service',
            'Teamwork',
            'Presentation',
          ],
        },
      ],
    },
    {
      kind: 'volunteering',
      items: [
        exp('Volunteer', 'Bristol Food Bank', 'Bristol', '2022', '2024', [
          'Sorted donations and packed food parcels on Saturday mornings',
        ]),
      ],
    },
  ],
);

const eng = (n: number) =>
  ({
    40: [
      'Designed and led delivery of a payments service handling 40 million requests a day with 99.95% availability',
      'Mentored eight engineers through code review, pairing and design reviews',
      'Introduced contract tests between services, cutting integration incidents by half',
      'Set up on-call and incident reviews with product and support teams',
    ],
    12: [
      'Owned the dispatch API handling 12 million requests a day',
      'Reduced p95 latency from 900 ms to 180 ms by redesigning caching and queries',
      'Ran the hiring loop for backend engineers and onboarded six new starters',
      'Worked with operations to prioritise reliability work over new features during peak season',
    ],
    2: [
      'Built the reconciliation service that matched 2 million ledger entries a day',
      'Replaced nightly batch jobs with event-driven processing, cutting delays from hours to minutes',
      'Wrote the team’s first testing guidelines and raised coverage on core modules',
    ],
  })[n] ?? [];

export const engineer = build(
  'engineer',
  'tech',
  {
    name: 'Daniel Okafor',
    headline: 'Senior Backend Engineer',
    email: 'daniel.okafor@example.com',
    phone: '+44 7700 900654',
    location: 'London (open to hybrid)',
    links: [
      { label: 'GitHub', url: 'github.com/dokafor' },
      { label: 'LinkedIn', url: 'linkedin.com/in/danielokafor' },
    ],
    summary:
      'Backend engineer with 14 years of experience building reliable payment and logistics platforms. I design pragmatic systems, lead teams through migrations without drama, and care about observability, testing and clear documentation. Most at home in TypeScript, Go and PostgreSQL on AWS.',
  },
  [
    {
      kind: 'experience',
      items: [
        exp(
          'Staff Engineer',
          'Northwind Payments',
          'London',
          '2022-01',
          '',
          [
            ...eng(40),
            'Led the migration from a monolith to six services over 18 months with no unplanned downtime',
            'Wrote the engineering career framework adopted across 90 engineers',
          ],
          true,
        ),
        exp('Senior Software Engineer', 'Parcelly', 'London', '2018-05', '2021-12', [
          ...eng(12),
          'Built route optimisation APIs used by 3,000 drivers daily',
        ]),
        exp('Software Engineer', 'Ledgerline', 'Manchester', '2015-03', '2018-04', eng(2)),
        exp('Software Engineer', 'Brightwave Digital', 'Manchester', '2013-01', '2015-02', [
          'Built e-commerce sites for retail clients in PHP and JavaScript',
          'Improved page load times by caching product catalogues',
        ]),
        exp('Junior Developer', 'Ashdown IT Services', 'Leeds', '2011-07', '2012-12', [
          'Maintained internal tools and wrote reporting scripts',
        ]),
        exp('IT Support Technician', 'Leeds City Council', 'Leeds', '2010-06', '2011-06', [
          'Supported 400 staff with hardware, accounts and software issues',
        ]),
      ],
    },
    {
      kind: 'skills',
      items: [
        { label: 'Languages', keywords: ['TypeScript', 'Go', 'Python', 'SQL'] },
        {
          label: 'Platforms',
          keywords: ['AWS', 'PostgreSQL', 'Kafka', 'Redis', 'Kubernetes', 'Terraform'],
        },
        {
          label: 'Practices',
          keywords: [
            'System design',
            'Observability',
            'Testing strategy',
            'Incident management',
            'Mentoring',
          ],
        },
      ],
    },
    {
      kind: 'projects',
      items: [
        {
          name: 'Open-source rate limiter',
          role: 'Maintainer',
          link: 'github.com/dokafor/tokenbucket',
          start: '2020',
          end: '',
          bullets: [
            'Go library for distributed rate limiting used in production by several companies',
          ],
        },
        {
          name: 'Payments reliability playbook',
          role: 'Author',
          link: '',
          start: '2023',
          end: '2023',
          bullets: ['Internal guide to idempotency, retries and reconciliation for payment flows'],
        },
      ],
    },
    {
      kind: 'education',
      items: [
        {
          qualification: 'BSc (Hons) Computer Science',
          institution: 'University of Leeds',
          location: 'Leeds',
          start: '2007',
          end: '2010',
          details: [],
        },
      ],
    },
    {
      kind: 'certifications',
      items: [
        {
          name: 'AWS Certified Solutions Architect – Professional',
          issuer: 'Amazon Web Services',
          date: '2024',
          detail: '',
        },
      ],
    },
  ],
);

export const executive = build(
  'executive',
  'executive',
  {
    name: 'Robert Hale',
    headline: 'Operations Director',
    email: 'robert.hale@example.com',
    phone: '+44 7700 900987',
    location: 'Surrey, United Kingdom',
    links: [{ label: 'LinkedIn', url: 'linkedin.com/in/roberthale' }],
    summary:
      'Operations director with more than twenty years of experience running multi-site food manufacturing and distribution businesses. Known for building strong leadership teams, improving safety and margins together, and leading organisations calmly through acquisition and change.',
  },
  [
    {
      kind: 'experience',
      items: [
        exp(
          'Operations Director',
          'Meridian Foods Group',
          'Guildford',
          '2017-01',
          '',
          [
            'Accountable for four manufacturing sites, 1,100 employees and an operating budget of £180m',
            'Delivered a three-year efficiency programme that improved operating margin by 3.2 points',
            'Halved lost-time injuries through a site-led safety culture programme',
            'Led operational integration of two acquisitions, retaining all key customers',
          ],
          true,
        ),
        exp('General Manager', 'Harvest Kitchen Ltd', 'Reading', '2011-06', '2016-12', [
          'Full P&L responsibility for a £60m chilled foods business',
          'Grew revenue by 40% through new retail contracts while maintaining service levels',
          'Built and led a senior team of eight across production, supply chain and quality',
        ]),
        exp('Head of Supply Chain', 'Albion Dairies', 'Bristol', '2005-03', '2011-05', [
          'Redesigned national distribution network, reducing transport cost by 12%',
          'Introduced sales and operations planning across the business',
        ]),
      ],
    },
    {
      kind: 'education',
      items: [
        {
          qualification: 'MBA',
          institution: 'Cranfield School of Management',
          location: '',
          start: '2008',
          end: '2010',
          details: [],
        },
        {
          qualification: 'BEng (Hons) Mechanical Engineering',
          institution: 'University of Bath',
          location: '',
          start: '1996',
          end: '1999',
          details: [],
        },
      ],
    },
    {
      kind: 'skills',
      title: 'Areas of expertise',
      items: [
        {
          label: '',
          keywords: [
            'Multi-site operations',
            'P&L leadership',
            'Mergers & integration',
            'Lean manufacturing',
            'Health & safety culture',
            'Board reporting',
          ],
        },
      ],
    },
    {
      kind: 'awards',
      title: 'Board & advisory roles',
      items: [
        {
          name: 'Non-executive Director',
          issuer: 'Surrey Food Network (charity)',
          date: '2021',
          detail: '',
        },
      ],
    },
  ],
);

export const sparse = build('sparse', 'general', { name: 'Ali Raza', phone: '0300 1234567' }, []);

export const extreme = build(
  'extreme',
  'general',
  {
    name: 'Maximiliana Alexandra-Østergaard von Löwenstein-Wertheim',
    headline: 'Senior Regional Logistics, Procurement & Warehouse Operations Coordinator (EMEA)',
    email: 'maximiliana.alexandra.ostergaard.von.loewenstein@example-very-long-domain.co.uk',
    phone: '+49 (0) 30 1234 5678 ext. 9012',
    location: 'Kraków, Poland · relocating to Zürich',
    links: [
      {
        label: 'Website',
        url: 'https://www.example.com/people/maximiliana-alexandra-ostergaard-von-loewenstein-wertheim/portfolio',
      },
    ],
    summary:
      'Coordinator with “hands-on” experience across procurement – warehousing – and last-mile delivery. Comfortable with accents (é, ø, ß, ł, ğ), symbols (& % € £ @ #) and very_long_words_without_any_spaces_that_must_wrap_gracefully_in_every_template.',
  },
  [
    {
      kind: 'experience',
      items: [
        exp(
          'Senior Regional Logistics, Procurement & Warehouse Operations Coordinator (EMEA)',
          'Großhandel & Logistik Gesellschaft mit beschränkter Haftung',
          'Düsseldorf, Germany',
          '2018-02',
          '',
          Array.from(
            { length: 12 },
            (_, i) =>
              `Responsibility number ${i + 1}: coordinated cross-border shipments, supplier negotiations and inventory audits across multiple warehouses and carriers, writing detailed reports for regional management.`,
          ),
          true,
        ),
        exp('Coordinator', 'Ølstad Freight', 'Oslo', '2015', '2018', ['Short role.']),
      ],
    },
    {
      kind: 'skills',
      items: [
        {
          label: 'A rather long label for a skill group',
          keywords: Array.from({ length: 24 }, (_, i) => `Skill ${i + 1} with words`),
        },
      ],
    },
    {
      kind: 'languages',
      items: [
        { language: 'German', fluency: 'Native' },
        { language: 'Polish', fluency: 'Professional working proficiency' },
        { language: 'Norwegian', fluency: 'Conversational' },
      ],
    },
    {
      kind: 'education',
      items: [
        {
          qualification: 'MSc Supply Chain Management',
          institution: 'Uniwersytet Ekonomiczny w Krakowie',
          location: 'Kraków',
          start: '2012',
          end: '2014',
          details: [],
        },
      ],
    },
  ],
);

/** Same CV with a sample portrait (for designs that show photos). */
export function withPhoto(
  doc: ResumeDocument,
  which: keyof typeof SAMPLE_PHOTOS = 'a',
): ResumeDocument {
  return { ...doc, basics: { ...doc.basics, photo: SAMPLE_PHOTOS[which] } };
}

export const PHOTO_FOR: Record<string, keyof typeof SAMPLE_PHOTOS> = {
  driver: 'b',
  teacher: 'a',
  nurse: 'a',
  graduate: 'a',
  engineer: 'b',
  executive: 'b',
  sparse: 'b',
  extreme: 'a',
};

export const FIXTURES = {
  driver,
  teacher,
  nurse,
  graduate,
  engineer,
  executive,
  sparse,
  extreme,
} as const;
export type FixtureId = keyof typeof FIXTURES;
