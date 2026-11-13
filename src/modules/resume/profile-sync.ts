import type { ResumeDocument } from './schema';

/**
 * "Update your profile too?" (complete-studio-spec §9.1): CVs are copies of the career profile
 * (same section and item ids). When a fact the person edits in a CV is still the old value in the
 * profile, the editor offers to make the same change there. Only facts change — never a CV's own
 * choices such as order, tailored summary or headline, hidden sections or design.
 */
export type ProfileChange =
  | { kind: 'basics'; key: (typeof BASICS)[number]; from: string; to: string }
  | { kind: 'field'; sectionId: string; itemId: string; key: string; from: string; to: string }
  | { kind: 'line'; sectionId: string; itemId: string; key: string; from: string; to: string };

const BASICS = ['name', 'email', 'phone', 'location'] as const;
const SKIP = new Set(['id', 'current', 'levels', 'level']);

type Rec = Record<string, unknown>;
const itemOf = (doc: ResumeDocument, sectionId: string, itemId: string) =>
  doc.sections.find((s) => s.id === sectionId)?.items.find((i) => i.id === itemId) as
    Rec | undefined;

/** Facts changed since `before` (the CV when the editor opened) that the profile still has as they were. */
export function profileChanges(
  before: ResumeDocument,
  now: ResumeDocument,
  profile: ResumeDocument,
): ProfileChange[] {
  const out: ProfileChange[] = [];
  for (const key of BASICS) {
    const from = before.basics[key];
    const to = now.basics[key];
    if (from !== to && profile.basics[key] === from) out.push({ kind: 'basics', key, from, to });
  }
  for (const s of now.sections)
    for (const it of s.items as Rec[]) {
      const was = itemOf(before, s.id, String(it.id));
      const prof = itemOf(profile, s.id, String(it.id));
      if (!was || !prof) continue; // new in this CV, or not in the profile
      for (const [key, v] of Object.entries(it)) {
        if (SKIP.has(key)) continue;
        const w = was[key];
        if (typeof v === 'string' && typeof w === 'string' && v !== w && prof[key] === w)
          out.push({ kind: 'field', sectionId: s.id, itemId: String(it.id), key, from: w, to: v });
        // Lists (points, details): a line edited in place, matched by its old text in the profile
        // (a tailored CV may order its points differently).
        if (
          Array.isArray(v) &&
          Array.isArray(w) &&
          v.length === w.length &&
          Array.isArray(prof[key])
        )
          (v as string[]).forEach((line, i) => {
            const old = (w as string[])[i]!;
            if (
              line !== old &&
              old.trim() &&
              line.trim() &&
              !(w as string[]).includes(line) && // moved, not edited
              (prof[key] as string[]).includes(old)
            )
              out.push({
                kind: 'line',
                sectionId: s.id,
                itemId: String(it.id),
                key,
                from: old,
                to: line,
              });
          });
      }
    }
  return out;
}

/** The profile with those changes made (a new object; untouched if nothing applies). */
export function applyToProfile(
  profile: ResumeDocument,
  changes: ProfileChange[],
  now = new Date(),
): ResumeDocument {
  const p = structuredClone(profile);
  for (const c of changes) {
    if (c.kind === 'basics') {
      if (p.basics[c.key] === c.from) p.basics[c.key] = c.to;
      continue;
    }
    const it = itemOf(p, c.sectionId, c.itemId);
    if (!it) continue;
    if (c.kind === 'field' && it[c.key] === c.from) it[c.key] = c.to;
    if (c.kind === 'line' && Array.isArray(it[c.key])) {
      const list = it[c.key] as string[];
      const i = list.indexOf(c.from);
      if (i >= 0) list[i] = c.to;
    }
  }
  p.updatedAt = now.toISOString();
  return p;
}
