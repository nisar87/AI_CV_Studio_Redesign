import { describe, expect, it } from 'vitest';
import type { Job } from '@/modules/jobs/schema';
import { FIXTURES } from '@/modules/resume/fixtures';
import type { DocumentSummary } from '@/modules/storage/repository';
import { nextAction, profileStrength } from './next-action';

const now = new Date('2026-11-13T10:00:00Z');
const doc = (o: Partial<DocumentSummary> = {}): DocumentSummary => ({
  id: 'cv1',
  title: 'My CV',
  name: 'Grace',
  presetId: 'teacher',
  templateId: 'clarity',
  role: 'cv',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-10T00:00:00Z',
  ...o,
});
const job = (o: Partial<Job> = {}): Job => ({
  id: 'j1',
  title: 'Teacher',
  company: 'Oakfield',
  location: '',
  url: '',
  advert: 'An advert',
  stage: 'saved',
  notes: '',
  appliedOn: '',
  documentIds: [],
  interviewNotes: [],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-11T00:00:00Z',
  ...o,
});

describe('nextAction', () => {
  it('no documents → upload', () => {
    expect(nextAction([], [], { now }).id).toBe('upload');
  });
  it('an interview comes first', () => {
    const a = nextAction([doc()], [job(), job({ id: 'j2', stage: 'interview' })], { now });
    expect(a).toMatchObject({ id: 'interview', href: '/jobs/j2#interview' });
  });
  it('a saved job without letter or CV → application kit', () => {
    expect(nextAction([doc()], [job()], { now })).toMatchObject({
      id: 'kit',
      href: '/jobs/j1#kit',
    });
  });
  it('applied over a week ago → follow up', () => {
    const a = nextAction([doc()], [job({ stage: 'applied', appliedOn: '2026-11-02' })], { now });
    expect(a.id).toBe('follow-up');
    expect(a.body).toContain('11 days');
  });
  it('a CV and no job → add a job; then a profile; then fixes; then design', () => {
    expect(nextAction([doc()], [], { now }).id).toBe('add-job');
    const applied = [job({ stage: 'applied', appliedOn: '2026-11-12' })];
    expect(nextAction([doc()], applied, { now }).id).toBe('profile');
    const withProfile = [doc(), doc({ id: 'p', role: 'profile' })];
    const sparse = { ...FIXTURES.sparse, id: 'p' };
    expect(nextAction(withProfile, applied, { now, profile: sparse }).id).toBe('fix');
    const full = { ...FIXTURES.teacher, id: 'p' };
    expect(nextAction(withProfile, applied, { now, profile: full }).id).toBe('design');
  });
});

describe('profileStrength', () => {
  it('maps every missing item to a fix link; a fuller CV scores higher', () => {
    const weak = profileStrength({ ...FIXTURES.sparse, id: 'x' });
    const strong = profileStrength({ ...FIXTURES.teacher, id: 'y' });
    expect(weak.percent).toBeLessThan(strong.percent);
    expect(weak.items.length).toBeGreaterThan(0);
    for (const i of weak.items) expect(i.href).toMatch(/^\/cv\/x/);
  });
});
