import type { DesignSpec, SectionKind } from './schema';
import type { PresetId } from './professions';

export type PresetSection = { kind: SectionKind; title: string };

export type Preset = {
  id: PresetId;
  /** Example job title shown as a placeholder. */
  headlineExample: string;
  /** Sections created for a new document, in page order. */
  sections: PresetSection[];
  /** Sections offered first under "Add section". */
  suggestedExtras: PresetSection[];
  design: Pick<DesignSpec, 'templateId' | 'accent' | 'fontPair'>;
  hints: {
    role: string;
    organization: string;
    bullet: string;
    summary: string;
    qualification: string;
    credential?: string;
  };
  suggestedSkills: string[];
};

const T = {
  experience: { kind: 'experience', title: 'Work history' },
  education: { kind: 'education', title: 'Education' },
  skills: { kind: 'skills', title: 'Skills' },
  languages: { kind: 'languages', title: 'Languages' },
  licences: { kind: 'licences', title: 'Licences' },
  certifications: { kind: 'certifications', title: 'Certifications' },
  registrations: { kind: 'certifications', title: 'Registration & certifications' },
  projects: { kind: 'projects', title: 'Projects' },
  volunteering: { kind: 'volunteering', title: 'Volunteering' },
  awards: { kind: 'awards', title: 'Awards' },
} as const satisfies Record<string, PresetSection>;

export const PRESETS: Record<PresetId, Preset> = {
  driver: {
    id: 'driver',
    headlineExample: 'Delivery Driver',
    sections: [T.experience, T.licences, T.skills, T.education],
    suggestedExtras: [T.languages, T.certifications],
    design: { templateId: 'clarity', accent: '#1f4e8c', fontPair: 'modern' },
    hints: {
      role: 'e.g. Multi-drop Van Driver',
      organization: 'e.g. Swift Logistics',
      bullet: 'e.g. Delivered around 120 parcels a day across 3 postcodes',
      summary: 'e.g. Reliable driver with 9 years of safe, on-time deliveries…',
      qualification: 'e.g. Secondary school certificate',
      credential: 'e.g. Category C1 licence',
    },
    suggestedSkills: [
      'Safe driving',
      'Route planning',
      'Time management',
      'Customer service',
      'Vehicle checks',
      'Loading & unloading',
      'Sat-nav & handheld scanners',
      'Cash handling',
    ],
  },
  teacher: {
    id: 'teacher',
    headlineExample: 'Primary School Teacher',
    sections: [T.experience, T.education, T.certifications, T.skills],
    suggestedExtras: [T.languages, T.volunteering, T.awards],
    design: { templateId: 'halo', accent: '#1e4f7a', fontPair: 'humanist' },
    hints: {
      role: 'e.g. Year 4 Class Teacher',
      organization: 'e.g. Oakfield Primary School',
      bullet: 'e.g. Planned and taught lessons for a class of 28 pupils',
      summary: 'e.g. Caring primary teacher with 8 years of experience…',
      qualification: 'e.g. PGCE Primary Education',
      credential: 'e.g. Qualified Teacher Status (QTS)',
    },
    suggestedSkills: [
      'Lesson planning',
      'Classroom management',
      'Differentiated teaching',
      'Safeguarding',
      'Assessment & feedback',
      'Parent communication',
      'Special educational needs (SEN)',
      'Educational technology',
    ],
  },
  healthcare: {
    id: 'healthcare',
    headlineExample: 'Registered Nurse',
    sections: [T.experience, T.registrations, T.education, T.skills],
    suggestedExtras: [T.languages, T.volunteering],
    design: { templateId: 'meridian', accent: '#1e6a6a', fontPair: 'classic' },
    hints: {
      role: 'e.g. Staff Nurse, Acute Medical Ward',
      organization: 'e.g. City General Hospital',
      bullet: 'e.g. Cared for up to 8 patients per shift on a 30-bed ward',
      summary: 'e.g. Compassionate registered nurse with experience in…',
      qualification: 'e.g. BSc (Hons) Adult Nursing',
      credential: 'e.g. NMC registration, BLS',
    },
    suggestedSkills: [
      'Patient care',
      'Medication administration',
      'Wound care',
      'Clinical observations',
      'Infection control',
      'Care planning',
      'Electronic patient records',
      'Team working',
    ],
  },
  retail: {
    id: 'retail',
    headlineExample: 'Sales Assistant',
    sections: [T.experience, T.skills, T.education],
    suggestedExtras: [T.languages, T.certifications],
    design: { templateId: 'sprout', accent: '#7a2e4d', fontPair: 'humanist' },
    hints: {
      role: 'e.g. Sales Assistant',
      organization: 'e.g. Harbour Street Café',
      bullet: 'e.g. Served customers at a busy till and handled cash accurately',
      summary: 'e.g. Friendly and dependable with experience in busy shops…',
      qualification: 'e.g. GCSEs in English and Maths',
    },
    suggestedSkills: [
      'Customer service',
      'Cash handling',
      'Stock control',
      'Food hygiene',
      'Teamwork',
      'Merchandising',
      'Point of sale systems',
      'Problem solving',
    ],
  },
  trades: {
    id: 'trades',
    headlineExample: 'Qualified Electrician',
    sections: [T.experience, T.licences, T.skills, T.education],
    suggestedExtras: [T.certifications, T.projects],
    design: { templateId: 'chronicle', accent: '#9a4a12', fontPair: 'classic' },
    hints: {
      role: 'e.g. Electrician',
      organization: 'e.g. Bright Spark Electrical Ltd',
      bullet: 'e.g. Installed and tested wiring in new-build homes',
      summary: 'e.g. Qualified electrician with 6 years on domestic and commercial sites…',
      qualification: 'e.g. Level 3 Electrical Installation',
      credential: 'e.g. CSCS card, 18th Edition',
    },
    suggestedSkills: [
      'Installation',
      'Fault finding',
      'Health & safety',
      'Reading drawings',
      'Testing & inspection',
      'Power tools',
      'Customer liaison',
      'Working at height',
    ],
  },
  office: {
    id: 'office',
    headlineExample: 'Office Administrator',
    sections: [T.experience, T.skills, T.education],
    suggestedExtras: [T.certifications, T.languages],
    design: { templateId: 'atelier', accent: '#2d4a6b', fontPair: 'modern' },
    hints: {
      role: 'e.g. Office Administrator',
      organization: 'e.g. Greenway Accountants',
      bullet: 'e.g. Managed diaries and meetings for a team of 12',
      summary: 'e.g. Organised administrator with strong experience in…',
      qualification: 'e.g. Diploma in Business Administration',
    },
    suggestedSkills: [
      'Microsoft Office',
      'Diary management',
      'Data entry',
      'Bookkeeping',
      'Customer service',
      'Filing & records',
      'Report writing',
      'Phone & email communication',
    ],
  },
  tech: {
    id: 'tech',
    headlineExample: 'Software Engineer',
    sections: [T.experience, T.skills, T.projects, T.education],
    suggestedExtras: [T.certifications, T.languages, T.awards],
    design: { templateId: 'ledger', accent: '#2b4c9b', fontPair: 'modern' },
    hints: {
      role: 'e.g. Senior Software Engineer',
      organization: 'e.g. Northwind Payments',
      bullet: 'e.g. Built the payments API used by 40 partner banks',
      summary: 'e.g. Backend engineer with 10 years building reliable systems…',
      qualification: 'e.g. BSc Computer Science',
      credential: 'e.g. AWS Certified Solutions Architect',
    },
    suggestedSkills: [
      'TypeScript',
      'Python',
      'SQL',
      'Cloud (AWS / Azure / GCP)',
      'System design',
      'Testing',
      'CI/CD',
      'Technical leadership',
    ],
  },
  executive: {
    id: 'executive',
    headlineExample: 'Operations Director',
    sections: [T.experience, T.education, T.skills],
    suggestedExtras: [T.awards, T.certifications, T.languages],
    design: { templateId: 'heritage', accent: '#7a5a2e', fontPair: 'executive' },
    hints: {
      role: 'e.g. Operations Director',
      organization: 'e.g. Meridian Foods Group',
      bullet: 'e.g. Led a team of 240 across four sites',
      summary: 'e.g. Operations leader with 20 years of experience in…',
      qualification: 'e.g. MBA',
    },
    suggestedSkills: [
      'Strategic planning',
      'P&L management',
      'Change management',
      'Stakeholder management',
      'Operational excellence',
      'Team leadership',
      'Budgeting',
      'Board reporting',
    ],
  },
  student: {
    id: 'student',
    headlineExample: 'Business Graduate',
    sections: [T.education, T.projects, T.experience, T.skills, T.volunteering],
    suggestedExtras: [T.awards, T.languages, T.certifications],
    design: { templateId: 'sprout', accent: '#2d6a3e', fontPair: 'humanist' },
    hints: {
      role: 'e.g. Part-time Retail Assistant',
      organization: 'e.g. Bookshop on Market Street',
      bullet: 'e.g. Helped customers find books and ran the till on weekends',
      summary: 'e.g. Recent graduate with a strong interest in…',
      qualification: 'e.g. BA (Hons) Business Management',
    },
    suggestedSkills: [
      'Teamwork',
      'Communication',
      'Microsoft Office',
      'Research',
      'Presentation',
      'Time management',
      'Problem solving',
      'Social media',
    ],
  },
  general: {
    id: 'general',
    headlineExample: 'Your job title',
    sections: [T.experience, T.education, T.skills],
    suggestedExtras: [T.languages, T.certifications, T.projects, T.volunteering],
    design: { templateId: 'clarity', accent: '#1f4e8c', fontPair: 'modern' },
    hints: {
      role: 'e.g. Warehouse Operative',
      organization: 'e.g. Company name',
      bullet: 'e.g. What you did, in a short sentence',
      summary: 'e.g. Two or three sentences about you and the work you want',
      qualification: 'e.g. Your highest qualification',
    },
    suggestedSkills: [
      'Communication',
      'Teamwork',
      'Reliability',
      'Problem solving',
      'Customer service',
      'Time management',
    ],
  },
};

export function getPreset(id: PresetId): Preset {
  return PRESETS[id];
}
