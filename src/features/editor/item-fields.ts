import type { Preset } from '@/modules/resume/presets';
import type { SectionKind } from '@/modules/resume/schema';

/**
 * Plain-language form definitions per section kind. The editor and the guided flow render
 * items from these, so wording stays consistent everywhere.
 */
export type FieldDef =
  | {
      key: string;
      type: 'text';
      label: string;
      hint?: string;
      placeholder?: (p: Preset) => string;
      half?: boolean;
      autoComplete?: string;
    }
  | { key: string; type: 'date'; label: string; half?: boolean }
  | { key: string; type: 'current'; label: string }
  | { key: string; type: 'lines'; label: string; hint: string; placeholder?: (p: Preset) => string }
  | {
      key: string;
      type: 'tags';
      label: string;
      hint: string;
      /** Offer an optional 1–5 level per keyword (stored in `levels`). */
      levels?: boolean;
    }
  | {
      key: string;
      type: 'select';
      label: string;
      options: { value: string; label: string }[];
      half?: boolean;
      hint?: string;
    };

export type KindInfo = {
  /** What one item is called: "job", "qualification"… */
  noun: string;
  /** Default section title for "Add section". */
  title: string;
  /** Description in "Add section" menu. */
  description: string;
  /** Guided-flow question. */
  question: string;
  fields: FieldDef[];
  /** Fields used to summarise a collapsed item: [title, subtitle]. */
  summary: [string, string];
};

const role: FieldDef = {
  key: 'role',
  type: 'text',
  label: 'Job title',
  placeholder: (p) => p.hints.role,
};
const org: FieldDef = {
  key: 'organization',
  type: 'text',
  label: 'Employer',
  placeholder: (p) => p.hints.organization,
  half: true,
};
const where: FieldDef = {
  key: 'location',
  type: 'text',
  label: 'Town or city',
  placeholder: () => 'e.g. Leicester',
  half: true,
};
const start: FieldDef = { key: 'start', type: 'date', label: 'Started', half: true };
const end: FieldDef = { key: 'end', type: 'date', label: 'Finished', half: true };
const bullets: FieldDef = {
  key: 'bullets',
  type: 'lines',
  label: 'What did you do?',
  hint: 'One thing per line. Short, clear sentences work best.',
  placeholder: (p) => p.hints.bullet,
};

const experienceFields: FieldDef[] = [
  role,
  org,
  where,
  start,
  end,
  { key: 'current', type: 'current', label: 'I still work here' },
  bullets,
];

const credential = (nameLabel: string, issuerLabel: string): FieldDef[] => [
  {
    key: 'name',
    type: 'text',
    label: nameLabel,
    placeholder: (p) => p.hints.credential ?? 'e.g. First Aid at Work',
  },
  {
    key: 'issuer',
    type: 'text',
    label: issuerLabel,
    placeholder: () => 'e.g. St John Ambulance',
    half: true,
  },
  { key: 'date', type: 'date', label: 'Date', half: true },
  {
    key: 'detail',
    type: 'text',
    label: 'Extra detail',
    placeholder: () => 'e.g. Valid until 2027',
  },
];

const LANGUAGE_LEVEL_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'basic', label: 'Basic' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'fluent', label: 'Fluent' },
  { value: 'native', label: 'Native' },
  { value: 'A1', label: 'A1 (beginner)' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2 (proficient)' },
];

export const KIND_INFO: Record<SectionKind, KindInfo> = {
  experience: {
    noun: 'job',
    title: 'Work history',
    description: 'Jobs you have done, newest first',
    question: 'Where have you worked?',
    fields: experienceFields,
    summary: ['role', 'organization'],
  },
  volunteering: {
    noun: 'role',
    title: 'Volunteering',
    description: 'Unpaid work and community roles',
    question: 'Have you volunteered anywhere?',
    fields: [
      { ...role, label: 'Role' },
      { ...org, label: 'Organisation' },
      where,
      start,
      end,
      { key: 'current', type: 'current', label: 'I still do this' },
      bullets,
    ],
    summary: ['role', 'organization'],
  },
  education: {
    noun: 'qualification',
    title: 'Education',
    description: 'Schools, colleges, universities and courses',
    question: 'What have you studied?',
    fields: [
      {
        key: 'qualification',
        type: 'text',
        label: 'Qualification',
        placeholder: (p) => p.hints.qualification,
      },
      {
        key: 'institution',
        type: 'text',
        label: 'School, college or university',
        placeholder: () => 'e.g. City College',
        half: true,
      },
      { key: 'location', type: 'text', label: 'Town or city', half: true },
      { key: 'start', type: 'date', label: 'Started', half: true },
      { key: 'end', type: 'date', label: 'Finished', half: true },
      {
        key: 'details',
        type: 'lines',
        label: 'Anything to add?',
        hint: 'Optional. Grades, subjects or a project — one per line.',
      },
    ],
    summary: ['qualification', 'institution'],
  },
  skills: {
    noun: 'skill group',
    title: 'Skills',
    description: 'What you are good at',
    question: 'What are you good at?',
    fields: [
      {
        key: 'keywords',
        type: 'tags',
        label: 'Skills',
        hint: 'Type a skill and press Enter, or tap a suggestion.',
        levels: true,
      },
      {
        key: 'label',
        type: 'text',
        label: 'Group name',
        hint: 'Optional — e.g. “Languages” or “Tools” if you list several groups.',
      },
    ],
    summary: ['label', 'keywords'],
  },
  languages: {
    noun: 'language',
    title: 'Languages',
    description: 'Languages you speak',
    question: 'Which languages do you speak?',
    fields: [
      {
        key: 'language',
        type: 'text',
        label: 'Language',
        placeholder: () => 'e.g. Urdu',
        half: true,
      },
      {
        key: 'fluency',
        type: 'text',
        label: 'How well?',
        placeholder: () => 'e.g. Fluent',
        half: true,
      },
      {
        key: 'level',
        type: 'select',
        label: 'Level (optional)',
        hint: 'Lets designs show language levels as bars or dots.',
        options: LANGUAGE_LEVEL_OPTIONS,
      },
    ],
    summary: ['language', 'fluency'],
  },
  certifications: {
    noun: 'certificate',
    title: 'Certifications',
    description: 'Certificates, registrations and training',
    question: 'Which certificates or registrations do you have?',
    fields: credential('Certificate or registration', 'Given by'),
    summary: ['name', 'issuer'],
  },
  licences: {
    noun: 'licence',
    title: 'Licences',
    description: 'Driving licences, cards and permits',
    question: 'Which licences or cards do you hold?',
    fields: credential('Licence or card', 'Issued by'),
    summary: ['name', 'issuer'],
  },
  awards: {
    noun: 'award',
    title: 'Awards',
    description: 'Prizes and recognition',
    question: 'Have you received any awards?',
    fields: credential('Award', 'Given by'),
    summary: ['name', 'issuer'],
  },
  projects: {
    noun: 'project',
    title: 'Projects',
    description: 'Things you have made or led',
    question: 'Which projects would you like to show?',
    fields: [
      {
        key: 'name',
        type: 'text',
        label: 'Project name',
        placeholder: () => 'e.g. School fundraising website',
      },
      {
        key: 'role',
        type: 'text',
        label: 'Your role',
        placeholder: () => 'e.g. Team leader',
        half: true,
      },
      {
        key: 'link',
        type: 'text',
        label: 'Link',
        placeholder: () => 'e.g. github.com/you/project',
        half: true,
      },
      start,
      end,
      { ...bullets, label: 'What did you do?' },
    ],
    summary: ['name', 'role'],
  },
  custom: {
    noun: 'entry',
    title: 'More',
    description: 'Anything else — memberships, publications, interests',
    question: 'What else would you like to add?',
    fields: [
      { key: 'title', type: 'text', label: 'Title' },
      { key: 'subtitle', type: 'text', label: 'Subtitle', half: true },
      { key: 'date', type: 'text', label: 'Date', placeholder: () => 'e.g. 2024', half: true },
      { key: 'bullets', type: 'lines', label: 'Details', hint: 'One per line.' },
    ],
    summary: ['title', 'subtitle'],
  },
  // ---- R8 section types (complete-studio-spec §9.2)
  publications: {
    noun: 'publication',
    title: 'Publications',
    description: 'Papers, articles and books — e.g. “Faster routing, Journal of Logistics, 2024”',
    question: 'What have you published?',
    fields: [
      {
        key: 'name',
        type: 'text',
        label: 'Title',
        placeholder: () => 'e.g. Faster routing for vans',
      },
      { key: 'issuer', type: 'text', label: 'Published in or by', half: true },
      { key: 'date', type: 'date', label: 'Date', half: true },
      { key: 'link', type: 'text', label: 'Link', placeholder: () => 'e.g. doi.org/…' },
      { key: 'detail', type: 'text', label: 'Co-authors or note' },
    ],
    summary: ['name', 'issuer'],
  },
  courses: {
    noun: 'course',
    title: 'Courses and training',
    description: 'Courses you took — e.g. “Excel for Business, Coursera, 2025”',
    question: 'Which courses have you done?',
    fields: credential('Course', 'Provider'),
    summary: ['name', 'issuer'],
  },
  memberships: {
    noun: 'membership',
    title: 'Memberships',
    description: 'Professional bodies and councils — e.g. “Member, Pakistan Engineering Council”',
    question: 'Which bodies are you a member of?',
    fields: credential('Membership', 'Organisation'),
    summary: ['name', 'issuer'],
  },
  conferences: {
    noun: 'talk',
    title: 'Conferences and talks',
    description: 'Talks you gave or events you presented at — e.g. “Speaker, DevFest 2025”',
    question: 'Where have you spoken or presented?',
    fields: [
      {
        key: 'name',
        type: 'text',
        label: 'Talk or role',
        placeholder: () => 'e.g. Speaker: Scaling SQL Server',
      },
      { key: 'issuer', type: 'text', label: 'Event', half: true },
      { key: 'date', type: 'date', label: 'Date', half: true },
      { key: 'link', type: 'text', label: 'Link to slides or video' },
      { key: 'detail', type: 'text', label: 'Extra detail' },
    ],
    summary: ['name', 'issuer'],
  },
  patents: {
    noun: 'patent',
    title: 'Patents',
    description: 'Patents you hold — e.g. “Cooling bracket, US 11,234,567”',
    question: 'Which patents do you hold?',
    fields: [
      { key: 'name', type: 'text', label: 'Patent title' },
      { key: 'issuer', type: 'text', label: 'Patent number', half: true },
      { key: 'date', type: 'date', label: 'Granted', half: true },
      { key: 'detail', type: 'text', label: 'Extra detail' },
    ],
    summary: ['name', 'issuer'],
  },
  military: {
    noun: 'service',
    title: 'Military service',
    description: 'Service, rank and duties — e.g. “Corporal, Royal Logistic Corps”',
    question: 'Where did you serve?',
    fields: [
      { ...role, label: 'Rank or role' },
      { ...org, label: 'Service or unit' },
      where,
      start,
      end,
      { key: 'current', type: 'current', label: 'I still serve' },
      bullets,
    ],
    summary: ['role', 'organization'],
  },
  internships: {
    noun: 'internship',
    title: 'Internships',
    description: 'Placements and work experience — e.g. “Summer intern, City Council”',
    question: 'Which internships have you done?',
    fields: [
      { ...role, label: 'Role' },
      { ...org, label: 'Organisation' },
      where,
      start,
      end,
      { key: 'current', type: 'current', label: 'I am still here' },
      bullets,
    ],
    summary: ['role', 'organization'],
  },
  interests: {
    noun: 'group',
    title: 'Interests',
    description: 'What you enjoy outside work — e.g. “Cricket, cooking, chess”',
    question: 'What do you enjoy outside work?',
    fields: [
      { key: 'keywords', type: 'tags', label: 'Interests', hint: 'Type one and press Enter.' },
      { key: 'label', type: 'text', label: 'Group name', hint: 'Optional.' },
    ],
    summary: ['label', 'keywords'],
  },
  achievements: {
    noun: 'achievement',
    title: 'Key achievements',
    description: 'Results you are proud of — e.g. “Cut delivery complaints by half”',
    question: 'What are you most proud of?',
    fields: [
      { key: 'title', type: 'text', label: 'Achievement' },
      { key: 'subtitle', type: 'text', label: 'Where', half: true },
      { key: 'date', type: 'text', label: 'When', placeholder: () => 'e.g. 2024', half: true },
      { key: 'bullets', type: 'lines', label: 'Details', hint: 'Optional. One per line.' },
    ],
    summary: ['title', 'subtitle'],
  },
  references: {
    noun: 'referee',
    title: 'References',
    description: 'People who can vouch for you — or “Available on request”',
    question: 'Who can give you a reference?',
    fields: [
      {
        key: 'name',
        type: 'text',
        label: 'Name',
        placeholder: () => 'e.g. Sara Khan, or “Available on request”',
      },
      { key: 'role', type: 'text', label: 'Their role', half: true },
      { key: 'organization', type: 'text', label: 'Organisation', half: true },
      {
        key: 'contact',
        type: 'text',
        label: 'Contact',
        hint: 'Ask them first. Email or phone.',
      },
    ],
    summary: ['name', 'organization'],
  },
  strengths: {
    noun: 'strength',
    title: 'Strengths',
    description: 'Your best qualities with proof — e.g. “Calm under pressure: …”',
    question: 'What are your strengths?',
    fields: [
      {
        key: 'title',
        type: 'text',
        label: 'Strength',
        placeholder: () => 'e.g. Calm under pressure',
      },
      { key: 'text', type: 'text', label: 'One line that shows it' },
    ],
    summary: ['title', 'text'],
  },
  testimonials: {
    noun: 'testimonial',
    title: 'Testimonials',
    description: 'Words from clients or managers — only real quotes they gave you',
    question: 'What have people said about your work?',
    fields: [
      { key: 'quote', type: 'text', label: 'Their words', hint: 'Copy exactly what they wrote.' },
      { key: 'name', type: 'text', label: 'Who said it', half: true },
      { key: 'role', type: 'text', label: 'Their role', half: true },
    ],
    summary: ['name', 'quote'],
  },
  personalDetails: {
    noun: 'detail',
    title: 'Personal details',
    description: 'Nationality, visa, driving licence… expected in some countries, not in others',
    question: 'Which personal details do employers in your country expect?',
    fields: [
      {
        key: 'label',
        type: 'text',
        label: 'Detail',
        placeholder: () => 'e.g. Nationality',
        half: true,
      },
      { key: 'value', type: 'text', label: 'Value', half: true },
    ],
    summary: ['label', 'value'],
  },
  declaration: {
    noun: 'declaration',
    title: 'Declaration',
    description: 'A signed statement that the CV is true — common in South Asia',
    question: 'Would you like to add a declaration?',
    fields: [
      { key: 'text', type: 'text', label: 'Statement' },
      { key: 'place', type: 'text', label: 'Place', half: true },
      {
        key: 'date',
        type: 'text',
        label: 'Date',
        half: true,
        placeholder: () => 'e.g. 13 November 2026',
      },
    ],
    summary: ['text', 'place'],
  },
};
