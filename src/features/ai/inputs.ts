import type { TaskInput } from '@/modules/ai/schemas';
import type { ResumeDocument } from '@/modules/resume/schema';

/** Build task inputs from the document — only the fields each task needs. */

const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

function jobs(doc: ResumeDocument) {
  return doc.sections
    .filter((s) => !s.hidden && (s.kind === 'experience' || s.kind === 'volunteering'))
    .flatMap((s) =>
      (s.items as Extract<ResumeDocument['sections'][number], { kind: 'experience' }>['items']).map(
        (j) => ({
          role: j.role.slice(0, 160),
          organization: j.organization.slice(0, 160),
          start: j.start,
          end: j.end,
          current: j.current,
          bullets: clean(j.bullets).slice(0, 12),
        }),
      ),
    )
    .filter((j) => j.role || j.organization || j.bullets.length)
    .slice(0, 6);
}

function skills(doc: ResumeDocument): string[] {
  return doc.sections
    .filter((s) => !s.hidden && s.kind === 'skills')
    .flatMap((s) => (s.items as { keywords: string[] }[]).flatMap((g) => g.keywords))
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 40);
}

export function summaryInput(
  doc: ResumeDocument,
  mode: 'write' | 'improve' | 'shorter',
): TaskInput<'write.summary'> {
  const education = doc.sections
    .filter(
      (s) =>
        !s.hidden &&
        (s.kind === 'education' || s.kind === 'certifications' || s.kind === 'licences'),
    )
    .flatMap((s) =>
      (s.items as Record<string, unknown>[]).map((i) => {
        const line = clean([
          String(i.qualification ?? i.name ?? ''),
          String(i.institution ?? i.issuer ?? ''),
        ]).join(', ');
        // Say what kind of item it is, so "certification" for a listed certificate is not new.
        const kind = { certifications: 'certificate', licences: 'licence' }[s.kind as string];
        return line && kind ? `${line} (${kind})` : line;
      }),
    )
    .filter(Boolean)
    .slice(0, 6);
  return {
    presetId: doc.presetId,
    headline: doc.basics.headline,
    currentSummary: mode === 'write' ? '' : doc.basics.summary,
    mode,
    experience: jobs(doc),
    education,
    skills: skills(doc),
  };
}

export function skillsInput(doc: ResumeDocument, existing: string[]): TaskInput<'suggest.skills'> {
  return {
    presetId: doc.presetId,
    headline: doc.basics.headline,
    experience: jobs(doc)
      .map((j) => [j.role, j.organization, ...j.bullets].filter(Boolean).join('. ').slice(0, 400))
      .slice(0, 20),
    existing: [...new Set([...skills(doc), ...existing])].slice(0, 60),
  };
}
