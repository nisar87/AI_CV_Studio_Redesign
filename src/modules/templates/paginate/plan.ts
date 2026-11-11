import { PLAN_PAGES_JS } from './runtime-source';

export type PlanBlock = { height: number; keep: 'none' | 'with-next' | 'together' };
export type PagePlan = { pages: number[][]; overflow: number[] };
export type PlanPages = (blocks: PlanBlock[], capacity: (pageIndex: number) => number) => PagePlan;

/**
 * Typed handle on the exact page-planning code shipped inside CV documents (for tests and tools).
 * Rules: blocks fill pages greedily; a block with keep="with-next" always travels with its
 * successor (headings, the second-last bullet of an entry); oversize chains break as late as
 * possible; a single block taller than a page is placed alone and reported in `overflow`.
 */
export const planPages: PlanPages = new Function(`return (${PLAN_PAGES_JS});`)() as PlanPages;
