import { describe, expect, it } from 'vitest';
import { coverage } from '@/modules/import/coverage';
import { FIXTURES } from '@/modules/resume/fixtures';
import { TEMPLATE_IDS, type ResumeDocument } from '@/modules/resume/schema';
import { applySuggestions, chipCounts, polishLines, weakBullet, wordingIssue } from './polish';
import { detectProfile } from './profile';
import { contentStats, DESIGN_TRAITS, rankDesigns, scoreDesign } from './rank';

const now = new Date('2026-11-12');
const generic = (d: ResumeDocument): ResumeDocument => ({ ...d, presetId: 'general' });

describe('detectProfile', () => {
  it.each([
    ['driver', 'driver'],
    ['teacher', 'teacher'],
    ['nurse', 'healthcare'],
    ['engineer', 'tech'],
    ['executive', 'executive'],
  ] as const)('reads the %s fixture as %s from its words alone', (f, want) => {
    expect(detectProfile(generic(FIXTURES[f]), now).presetId).toBe(want);
  });

  it('works out years and seniority from the dates', () => {
    const p = detectProfile(FIXTURES.executive, now);
    expect(p.years).toBeGreaterThanOrEqual(10);
    expect(p.seniority).toBe('senior');
  });
});

describe('rankDesigns', () => {
  const all = [...TEMPLATE_IDS];

  it('returns six designs, best first, with at least one single-column, side-column and bold design', () => {
    for (const [id, doc] of Object.entries(FIXTURES)) {
      const p = detectProfile(doc, now);
      const r = rankDesigns(contentStats(doc, p.presetId, false), all);
      expect(r, id).toHaveLength(6);
      expect(new Set(r.map((x) => x.id)).size).toBe(6);
      const traits = r.map((x) => DESIGN_TRAITS[x.id]);
      expect(
        traits.some((t) => t.family === 'single'),
        id,
      ).toBe(true);
      expect(
        traits.some((t) => t.family === 'sidebar'),
        id,
      ).toBe(true);
      expect(
        traits.some((t) => t.bold),
        id,
      ).toBe(true);
      expect([...r].sort((a, b) => b.score - a.score)).toEqual(r);
    }
  });

  it('favours designs suited to the profession', () => {
    const s = contentStats(FIXTURES.driver, 'driver', false);
    expect(rankDesigns(s, all)[0]!.id).toBe('chronicle');
    const t = contentStats(FIXTURES.teacher, 'teacher', true);
    expect(
      rankDesigns(t, all)
        .slice(0, 2)
        .map((x) => x.id),
    ).toContain('halo');
  });

  it('gives photo designs the photo points only when there is a photo', () => {
    const s = contentStats(FIXTURES.executive, 'executive', true);
    expect(scoreDesign('heritage', s).score).toBeLessThan(
      scoreDesign('heritage', { ...s, hasPhoto: false }).score,
    );
  });

  it('only ranks enabled designs', () => {
    const r = rankDesigns(contentStats(FIXTURES.nurse, 'healthcare', false), [
      'clarity',
      'meridian',
    ]);
    expect(r.map((x) => x.id).sort()).toEqual(['clarity', 'meridian']);
  });
});

describe('polish', () => {
  it('spots wording problems and weak bullets', () => {
    expect(wordingIssue('i managed the stock')).toBe(true);
    expect(wordingIssue('Responsable for the till')).toBe(true);
    expect(wordingIssue('Managed the stock')).toBe(false);
    expect(weakBullet('Responsible for the till')).toBe(true);
    expect(weakBullet('Served 80 customers a day')).toBe(false);
  });

  it('addresses lines by id and applies only accepted suggestions', () => {
    const doc = structuredClone(FIXTURES.driver);
    const lines = polishLines(doc, 'bullets');
    expect(lines.length).toBeGreaterThan(0);
    const first = lines[0]!;
    const next = applySuggestions(doc, [
      { id: first.id, after: 'Changed line', reason: '' },
      { id: 'nope/nope/bullets/0', after: 'x', reason: '' },
    ]);
    expect(polishLines(next, 'bullets')[0]!.text).toBe('Changed line');
    expect(polishLines(doc, 'bullets')[0]!.text).toBe(first.text);
    expect(
      applySuggestions(doc, [{ id: 'summary', after: 'New', reason: '' }]).basics.summary,
    ).toBe('New');
  });

  it('counts chips for each fixture without throwing', () => {
    for (const doc of Object.values(FIXTURES)) {
      const c = chipCounts(doc);
      expect(c.wording).toBeGreaterThanOrEqual(0);
      expect(c.gaps).toBeGreaterThanOrEqual(0);
    }
    const sparse = chipCounts(FIXTURES.sparse);
    expect(sparse.gaps).toBeGreaterThan(0);
  });
});

describe('coverage', () => {
  it('is complete when every content word is placed, and lists lines that are not', () => {
    const doc = FIXTURES.driver;
    const lines = [doc.basics.name, doc.basics.summary];
    expect(coverage(lines, doc).ratio).toBe(1);
    const c = coverage([...lines, 'Zebra crossing warden at Quixotic Ltd'], doc);
    expect(c.ratio).toBeLessThan(1);
    expect(c.missing).toEqual(['Zebra crossing warden at Quixotic Ltd']);
  });

  it('ignores month names and numbers, which are rewritten as dates', () => {
    expect(coverage(['January 2021 – Present'], FIXTURES.driver).ratio).toBe(1);
  });
});
