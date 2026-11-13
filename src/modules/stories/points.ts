import { profileDigest, type Digest } from '@/modules/jobs/digest';
import type { ResumeDocument } from '@/modules/resume/schema';

/** A CV point a story can grow from: a job, project or other bullet, with its parent line. */
export type StoryPoint = { id: string; text: string; role: string };

const POINT_ID = /^((?:J|V|PROJ|OTHER)\d+)\.B\d+$/;

/** Every point in the CV that could become a story, in CV order. */
export function storyPoints(
  doc: ResumeDocument,
  digest: Digest = profileDigest(doc),
): StoryPoint[] {
  const out: StoryPoint[] = [];
  for (const l of digest.lines.values()) {
    const m = POINT_ID.exec(l.id);
    if (!m) continue;
    out.push({ id: l.id, text: l.text, role: digest.lines.get(m[1]!)?.text ?? '' });
  }
  return out;
}
