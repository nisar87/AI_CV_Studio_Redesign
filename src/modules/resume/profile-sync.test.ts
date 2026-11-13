import { describe, expect, it } from 'vitest';
import { driver } from './fixtures';
import { cvFromProfile, makeProfile } from './profile';
import { applyToProfile, profileChanges } from './profile-sync';
import type { ExperienceItem } from './schema';

const profile = makeProfile(driver);
const cv = cvFromProfile(profile);
const exp = cv.sections.find((s) => s.kind === 'experience')!;

function edit(fn: (d: typeof cv) => void) {
  const d = structuredClone(cv);
  fn(d);
  return d;
}

describe('update your profile too', () => {
  it('finds facts edited in the CV that the profile still has as before', () => {
    const now = edit((d) => {
      d.basics.phone = '07700 111222';
      d.basics.summary = 'Tailored summary'; // a CV's own choice: never synced
      const job = d.sections.find((s) => s.id === exp.id)!.items[0] as ExperienceItem;
      job.role = 'Senior Van Driver';
      job.bullets[1] = 'Planned routes for 3 drivers each morning';
    });
    const ch = profileChanges(cv, now, profile);
    expect(ch.map((c) => c.kind)).toEqual(['basics', 'field', 'line']);
    const next = applyToProfile(profile, ch);
    const job = next.sections.find((s) => s.id === exp.id)!.items[0] as ExperienceItem;
    expect(next.basics.phone).toBe('07700 111222');
    expect(next.basics.summary).toBe(profile.basics.summary);
    expect(job.role).toBe('Senior Van Driver');
    expect(job.bullets).toContain('Planned routes for 3 drivers each morning');
    expect(job.bullets).toHaveLength(
      (profile.sections.find((s) => s.id === exp.id)!.items[0] as ExperienceItem).bullets.length,
    );
  });

  it('ignores reordering, items only in the CV, and facts the profile already changed', () => {
    const reordered = edit((d) => {
      const job = d.sections.find((s) => s.id === exp.id)!.items[0] as ExperienceItem;
      job.bullets.reverse();
    });
    // Moving points is a CV's own choice, not an edit of a fact.
    expect(profileChanges(cv, reordered, profile)).toEqual([]);

    const changedProfile = structuredClone(profile);
    changedProfile.basics.phone = 'already new';
    const now = edit((d) => (d.basics.phone = '07700 111222'));
    expect(profileChanges(cv, now, changedProfile)).toEqual([]);
  });
});
