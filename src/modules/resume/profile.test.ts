import { describe, expect, it } from 'vitest';
import { driver } from './fixtures';
import { cvFromProfile, isProfile, makeProfile } from './profile';
import { resumeDocument } from './schema';

describe('career profile', () => {
  it('makes a profile from a CV and CVs from the profile, keeping every fact', () => {
    const p = makeProfile({ ...driver, jobId: 'x', parentId: 'y' });
    expect(isProfile(p)).toBe(true);
    expect(p.id).not.toBe(driver.id);
    expect(p).not.toHaveProperty('jobId');
    expect(p.sections).toEqual(driver.sections);
    const cv = cvFromProfile(p, { jobId: 'job-1' });
    expect(isProfile(cv)).toBe(false);
    expect(cv).toMatchObject({ parentId: p.id, jobId: 'job-1', basics: driver.basics });
    expect(resumeDocument.safeParse(p).success).toBe(true);
    expect(resumeDocument.safeParse(cv).success).toBe(true);
  });
});
