import type { ResumeDocument } from '@/modules/resume/schema';

export type Check = { id: string; ok: boolean; okText: string; todoText: string };

const hasText = (s: string) => s.trim().length > 0;
const PLACEHOLDER = /\{\{\?[^}]*\}\}/;

/** Plain-language pre-download checks. Never blocks download; only points at likely gaps. */
export function checklist(doc: ResumeDocument): Check[] {
  const b = doc.basics;
  const visible = doc.sections.filter((s) => !s.hidden);
  const hasHistory = visible.some((s) =>
    s.kind === 'experience'
      ? s.items.some((i) => hasText(i.role) || hasText(i.organization))
      : s.kind === 'education'
        ? s.items.some((i) => hasText(i.qualification) || hasText(i.institution))
        : false,
  );
  const json = JSON.stringify(doc.sections) + b.summary;
  const missingDates = visible
    .filter((s) => s.kind === 'experience')
    .flatMap((s) => s.items as { role: string; start: string; end: string; current: boolean }[])
    .some((i) => hasText(i.role) && !i.start && !i.end && !i.current);

  return [
    {
      id: 'name',
      ok: hasText(b.name),
      okText: 'Your name is at the top',
      todoText: 'Add your name',
    },
    {
      id: 'contact',
      ok: hasText(b.phone) || hasText(b.email),
      okText: 'Employers can contact you',
      todoText: 'Add a phone number or email so employers can reach you',
    },
    {
      id: 'history',
      ok: hasHistory,
      okText: 'Work or education is included',
      todoText: 'Add at least one job or qualification',
    },
    {
      id: 'dates',
      ok: !missingDates,
      okText: 'Jobs have dates',
      todoText: 'Some jobs have no dates — employers usually expect them',
    },
    {
      id: 'placeholders',
      ok: !PLACEHOLDER.test(json),
      okText: 'No details waiting for your input',
      todoText: 'Some suggested sentences still need a detail from you',
    },
  ];
}
