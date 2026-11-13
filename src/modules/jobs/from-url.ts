import type { TaskOutput } from '@/modules/ai/schemas';
import { isOwnLine, onPage, sliceBetween, type PageInfo } from './page';

/** What a job link gives the Add-a-job form (the person checks it and saves it). */
export type JobFromUrl = {
  url: string;
  title: string;
  company: string;
  location: string;
  advert: string;
  /** How it was read: the page's own job data, AI reading the page, or the plain page text. */
  via: 'structured' | 'ai' | 'page';
};

const MAX_ADVERT = 12_000;
const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/** "Delivery Driver - Fresh Foods Ltd | Indeed" → "Delivery Driver". */
export function titleFromPageTitle(t: string): string {
  return clean(t.split(/\s+[|–—-]\s+/)[0] ?? '', 160);
}

/** From the page's own JSON-LD JobPosting (no AI needed). */
export function fromPosting(url: string, info: PageInfo): JobFromUrl | null {
  const p = info.posting;
  if (!p) return null;
  return {
    url,
    title: clean(p.title, 160),
    company: clean(p.company || info.siteName, 160),
    location: clean(p.location, 120),
    advert: p.advert.slice(0, MAX_ADVERT),
    via: 'structured',
  };
}

/** Without AI: the page title and its text, for the person to tidy. */
export function fromPlainPage(url: string, info: PageInfo): JobFromUrl {
  return {
    url,
    title: titleFromPageTitle(info.title),
    company: clean(info.siteName, 160),
    location: '',
    advert: info.text.slice(0, MAX_ADVERT),
    via: 'page',
  };
}

/**
 * The AI's reading, kept only where it is really on the page: title, company and place must
 * appear in the page text (or title); the advert is cut from the page between the AI's quoted
 * first and last words, so it is the page's own text. Null when it isn't a job advert.
 */
export function fromExtract(
  url: string,
  info: PageInfo,
  out: TaskOutput<'jobs.extract'>,
): JobFromUrl | null {
  if (!out.isJob) return null;
  const seen = `${info.title}\n${info.text}`;
  const keep = (v: string, max: number) => (onPage(v, seen) ? clean(v, max) : '');
  const cut = sliceBetween(info.text, out.start, out.end);
  // The title must be the page's title or a heading line — never words lifted from a sentence
  // (where an instruction hidden in the page could put "Chief Executive").
  const titleOk = onPage(out.title, info.title) || isOwnLine(out.title, info.text);
  return {
    url,
    title: (titleOk ? clean(out.title, 160) : '') || titleFromPageTitle(info.title),
    company: keep(out.company, 160) || clean(info.siteName, 160),
    location: keep(out.location, 120),
    advert: (cut && cut.length >= 80 ? cut : info.text).slice(0, MAX_ADVERT),
    via: 'ai',
  };
}
