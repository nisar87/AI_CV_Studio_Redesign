import { describe, expect, it } from 'vitest';
import { planPages, type PlanBlock } from './plan';

const b = (height: number, keep: PlanBlock['keep'] = 'none'): PlanBlock => ({ height, keep });
const cap =
  (first: number, rest = first) =>
  (p: number) =>
    p === 0 ? first : rest;

describe('planPages', () => {
  it('puts everything on one page when it fits', () => {
    expect(planPages([b(10), b(20), b(30)], cap(100)).pages).toEqual([[0, 1, 2]]);
  });

  it('moves a block that does not fit to the next page', () => {
    expect(planPages([b(60), b(30), b(20)], cap(100)).pages).toEqual([[0, 1], [2]]);
  });

  it('uses a smaller first-page capacity (header space)', () => {
    expect(planPages([b(40), b(40), b(40)], cap(70, 100)).pages).toEqual([[0], [1, 2]]);
  });

  it('never leaves a heading (keep with next) at the bottom of a page', () => {
    // heading(10) + entry(50) would overflow page 1 → both move.
    const { pages } = planPages([b(60), b(10, 'with-next'), b(50)], cap(100));
    expect(pages).toEqual([[0], [1, 2]]);
  });

  it('follows chains of keep-with-next', () => {
    const { pages } = planPages([b(50), b(10, 'with-next'), b(20, 'with-next'), b(30)], cap(100));
    expect(pages).toEqual([[0], [1, 2, 3]]);
  });

  it('breaks an oversized chain as late as possible instead of looping', () => {
    const { pages, overflow } = planPages(
      [b(10, 'with-next'), b(80, 'with-next'), b(80)],
      cap(100),
    );
    expect(pages).toEqual([[0, 1], [2]]);
    expect(overflow).toEqual([]);
  });

  it('never strands a heading when its content only fits on a later, taller page', () => {
    // Page 1 is short (header); heading + big block fit only on page 2.
    const { pages, overflow } = planPages([b(10, 'with-next'), b(80)], cap(60, 100));
    expect(pages).toEqual([[], [0, 1]]);
    expect(overflow).toEqual([]);
  });

  it('keeps a heading with its block when the chain is broken', () => {
    const { pages } = planPages([b(10, 'with-next'), b(70, 'with-next'), b(60)], cap(100));
    expect(pages[0]).toEqual([0, 1]);
  });

  it('uses the shorter full-width heights from wideFrom on', () => {
    const blocks = [
      b(60),
      { height: 60, keep: 'none' as const, wide: 40 },
      { height: 60, keep: 'none' as const, wide: 40 },
    ];
    // Page 2+ is wide: the two blocks (40 + 40) fit together there.
    expect(planPages(blocks, cap(100), 1).pages).toEqual([[0], [1, 2]]);
    // Without wide pages they need a page each.
    expect(planPages(blocks, cap(100)).pages).toEqual([[0], [1], [2]]);
  });

  it('flags a single block taller than a page', () => {
    const { pages, overflow } = planPages([b(20), b(150), b(20)], cap(100));
    expect(pages).toEqual([[0], [1], [2]]);
    expect(overflow).toEqual([1]);
  });

  it('handles empty input', () => {
    expect(planPages([], cap(100))).toEqual({ pages: [[]], overflow: [] });
  });

  it('is the exact source shipped inside documents', async () => {
    const { RUNTIME_JS, PLAN_PAGES_JS } = await import('./runtime-source');
    expect(RUNTIME_JS).toContain(PLAN_PAGES_JS);
    expect(RUNTIME_JS).not.toMatch(/__name|_object_spread|require\(/);
  });
});
