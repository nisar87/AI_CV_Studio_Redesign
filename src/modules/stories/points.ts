import { profileDigest, type Digest } from '@/modules/jobs/digest';
import type { ResumeDocument } from '@/modules/resume/schema';

/** A CV point a story can grow from: a job, project or other bullet, with its parent line. */
export type StoryPoint = { id: string; text: string; role: string };

const POINT_ID = /^((J|V|PROJ|OTHER)\d+)\.B\d+$/;
const ORDER: Record<string, number> = { J: 0, V: 1, PROJ: 2, OTHER: 3 };
/** "Nationality: …", "Phone / WhatsApp: …": personal details, never a story. */
const PERSONAL =
  /^(nationality|date of birth|dob|birth|phone|mobile|whatsapp|e-?mail|address|marital|gender|religion|visa|passport|driving licen[cs]e|age|languages?)\b[^:]{0,20}:/i;

/** Is this line something that happened (not a list of skills or a personal detail)? */
function storyLike(text: string): boolean {
  if (PERSONAL.test(text)) return false;
  if ((text.match(/[|;•·]/g) ?? []).length >= 2) return false;
  return text.split(/\s+/).length >= 5;
}

/**
 * Points in the CV that could become a story: job, volunteering and project points first (in CV
 * order), then other sections' points that read like something that happened.
 */
export function storyPoints(
  doc: ResumeDocument,
  digest: Digest = profileDigest(doc),
): StoryPoint[] {
  const out: (StoryPoint & { rank: number; at: number })[] = [];
  for (const l of digest.lines.values()) {
    const m = POINT_ID.exec(l.id);
    if (!m || !storyLike(l.text)) continue;
    out.push({
      id: l.id,
      text: l.text,
      role: digest.lines.get(m[1]!)?.text ?? '',
      rank: ORDER[m[2]!] ?? 3,
      at: out.length,
    });
  }
  return out
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .map(({ id, text, role }) => ({ id, text, role }));
}
