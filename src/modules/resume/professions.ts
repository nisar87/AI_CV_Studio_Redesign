/**
 * Profession presets as shown to users on the Start page.
 * Section structure and hints per preset are defined in presets.ts (Phase 2).
 */
export const PRESET_IDS = [
  'driver',
  'teacher',
  'healthcare',
  'retail',
  'trades',
  'office',
  'tech',
  'executive',
  'student',
  'general',
] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export type ProfessionInfo = {
  id: PresetId;
  /** Card title, in plain words. */
  name: string;
  /** One-line example so people recognise themselves. */
  example: string;
};

export const PROFESSIONS: readonly ProfessionInfo[] = [
  { id: 'driver', name: 'Driving & delivery', example: 'Van, truck, taxi, courier' },
  { id: 'teacher', name: 'Teaching & education', example: 'Teacher, tutor, teaching assistant' },
  { id: 'healthcare', name: 'Healthcare & nursing', example: 'Nurse, carer, pharmacy, clinic' },
  { id: 'retail', name: 'Shops, cafés & hotels', example: 'Sales, cashier, waiter, reception' },
  {
    id: 'trades',
    name: 'Trades & construction',
    example: 'Electrician, plumber, builder, mechanic',
  },
  { id: 'office', name: 'Office & admin', example: 'Administration, accounts, customer service' },
  { id: 'tech', name: 'Technology & engineering', example: 'Developer, engineer, IT support' },
  {
    id: 'executive',
    name: 'Management & leadership',
    example: 'Manager, director, head of department',
  },
  { id: 'student', name: 'Student or first job', example: 'Graduate, school leaver, internship' },
  { id: 'general', name: 'Something else', example: 'Any other kind of work' },
];

export function getProfession(id: string): ProfessionInfo | undefined {
  return PROFESSIONS.find((p) => p.id === id);
}
