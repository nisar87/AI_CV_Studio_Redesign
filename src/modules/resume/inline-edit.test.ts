import { describe, expect, it } from 'vitest';
import { driver } from './fixtures';
import { findInlineField, inlinePatch } from './inline-edit';
import type { ExperienceItem } from './schema';

const exp = driver.sections.find((s) => s.kind === 'experience')!;
const job = exp.items[0] as ExperienceItem;

describe('edit on the page', () => {
  it('maps a clicked text to exactly one field', () => {
    expect(findInlineField(driver, 'basics/contact', driver.basics.name)).toEqual({
      kind: 'basics',
      key: 'name',
    });
    expect(findInlineField(driver, `${exp.id}/${job.id}`, `  ${job.role} `)).toEqual({
      kind: 'item',
      sectionId: exp.id,
      itemId: job.id,
      key: 'role',
    });
    expect(findInlineField(driver, `${exp.id}/${job.id}`, job.bullets[1]!)).toMatchObject({
      key: 'bullets',
      index: 1,
    });
  });

  it('does not offer combined or formatted text (dates, "Employer · Town")', () => {
    expect(
      findInlineField(driver, `${exp.id}/${job.id}`, `${job.organization} · ${job.location}`),
    ).toBeNull();
    expect(findInlineField(driver, `${exp.id}/${job.id}`, 'Apr 2019 – Present')).toBeNull();
    expect(findInlineField(driver, 'nope/nope', job.role)).toBeNull();
  });

  it('patches only that field; an emptied bullet is removed', () => {
    const f = findInlineField(driver, `${exp.id}/${job.id}`, job.bullets[0]!)!;
    const p = inlinePatch(driver, f, 'Delivered 130 parcels a day');
    expect(p).toEqual({
      sectionId: exp.id,
      itemId: job.id,
      patch: { bullets: ['Delivered 130 parcels a day', ...job.bullets.slice(1)] },
    });
    const gone = inlinePatch(driver, f, '  ');
    expect((gone as unknown as { patch: { bullets: string[] } }).patch.bullets).toEqual(
      job.bullets.slice(1),
    );
    expect(inlinePatch(driver, { kind: 'basics', key: 'headline' }, '  Van  driver ')).toEqual({
      basics: { headline: 'Van driver' },
    });
  });
});
