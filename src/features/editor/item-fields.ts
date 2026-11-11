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
  | { key: string; type: 'tags'; label: string; hint: string };

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
};
