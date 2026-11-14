import { z } from 'zod';
import { currentDesignId } from '@/modules/design/catalogue';
import { DESIGN_META, isDesignId, type Family } from '@/modules/design/designs';
import type { ResumeDocument } from '@/modules/resume/schema';

/**
 * Portfolio themes (complete-studio-spec §10 "Portfolio upgrade": 6 themes from the design
 * families, project galleries with images, contact form, custom sections, QR code).
 * Pure: used by the page, the settings screen, the API and the tests.
 */
export const THEMES = ['clean', 'classic', 'sidebar', 'editorial', 'timeline', 'bold'] as const;
export type Theme = (typeof THEMES)[number];
export type PortfolioTheme = Theme | 'auto';

export const THEME_INFO: Record<Theme, { name: string; hint: string }> = {
  clean: { name: 'Clean', hint: 'Calm and simple, one column' },
  classic: { name: 'Classic', hint: 'Centred, serif headings, warm paper' },
  sidebar: { name: 'Sidebar', hint: 'Your details and skills in a side column' },
  editorial: { name: 'Editorial', hint: 'Large type and numbered sections, like a magazine' },
  timeline: { name: 'Timeline', hint: 'Dates down the side, your career at a glance' },
  bold: { name: 'Bold', hint: 'A colour band and cards, made to stand out' },
};

/** Each design family's portfolio theme (the two families without their own use the closest). */
export const FAMILY_THEME: Record<Family, Theme> = {
  clean: 'clean',
  classic: 'classic',
  sidebar: 'sidebar',
  editorial: 'editorial',
  timeline: 'timeline',
  bold: 'bold',
  portrait: 'sidebar', // photo-led: the side column carries a large photo
  compact: 'clean',
};

/** The theme that matches a CV's design (a custom Design Studio design uses its origin). */
export function themeForDoc(doc: ResumeDocument): Theme {
  const d = doc.design;
  const id = currentDesignId(d) ?? d.v2?.origin ?? d.templateId;
  return isDesignId(id) ? FAMILY_THEME[DESIGN_META[id].family] : 'clean';
}

/** The theme a page shows: its own choice, or the CV's design family. */
export const resolveTheme = (theme: PortfolioTheme | undefined, doc: ResumeDocument): Theme =>
  theme && theme !== 'auto' ? theme : themeForDoc(doc);

// ---------------------------------------------------------------------------------------------
// Owner input

export const MAX_SECTIONS = 6;
export const MAX_PROJECTS = 8;
export const MAX_IMAGES_PER_PROJECT = 4;
/** Pictures kept per account (each ≤ MAX_IMAGE_BYTES). */
export const MAX_IMAGES = 40;
export const MAX_IMAGE_BYTES = 600 * 1024;

const plain = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const oneLine = (s: string) => plain(s).replace(/\s+/g, ' ');
const text = (max: number, what: string) =>
  z
    .string()
    .default('')
    .transform(plain)
    .pipe(z.string().max(max, `Keep ${what} under ${max} characters.`));
const line = (max: number, what: string) =>
  z
    .string()
    .default('')
    .transform(oneLine)
    .pipe(z.string().max(max, `Keep ${what} under ${max} characters.`));

/** Links on a public page: https (or http) web addresses only, never javascript: and the like. */
export const webLink = z
  .string()
  .default('')
  .transform((s) => s.trim())
  .refine((s) => {
    if (!s) return true;
    try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
      return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname.includes('.');
    } catch {
      return false;
    }
  }, 'Use a web address, like example.com/my-work.')
  .transform((s) => (!s || /^https?:\/\//i.test(s) ? s : `https://${s}`))
  .pipe(z.string().max(300, 'That web address is too long.'));

const id = z.string().regex(/^[\w-]{1,40}$/);

export const sectionInput = z.object({
  id,
  title: line(60, 'the title').pipe(z.string().min(1, 'Give each section a title.')),
  text: text(2000, 'a section'),
  link: webLink,
  linkLabel: line(60, 'the link text'),
});
export type PortfolioSection = z.output<typeof sectionInput>;

export const imageRef = z.object({ id, alt: line(140, 'picture descriptions') });
export const projectInput = z.object({
  id,
  title: line(80, 'the project name').pipe(z.string().min(1, 'Give each project a name.')),
  text: text(800, 'a project description'),
  link: webLink,
  images: z
    .array(imageRef)
    .max(MAX_IMAGES_PER_PROJECT, 'Up to 4 pictures per project.')
    .default([]),
});
export type PortfolioProject = z.output<typeof projectInput>;

export const extrasInput = z.object({
  theme: z.enum(['auto', ...THEMES]).default('auto'),
  sections: z.array(sectionInput).max(MAX_SECTIONS, `Up to ${MAX_SECTIONS} sections.`).default([]),
  projects: z.array(projectInput).max(MAX_PROJECTS, `Up to ${MAX_PROJECTS} projects.`).default([]),
  contact: z.boolean().default(false),
});
export type PortfolioExtras = z.output<typeof extrasInput>;

/** Every picture id the page uses. */
export const usedImages = (projects: PortfolioProject[] | undefined) =>
  new Set((projects ?? []).flatMap((p) => p.images.map((i) => i.id)));

// ---------------------------------------------------------------------------------------------
// Contact form

export const contactInput = z.object({
  name: line(80, 'your name').pipe(z.string().min(1, 'Add your name.')),
  email: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(200).email('Add an email address they can reply to.')),
  message: text(2000, 'your message').pipe(z.string().min(1, 'Write a message.')),
  /** Honeypot: people never fill it in. */
  website: z.string().max(200).optional(),
});
export type ContactInput = z.output<typeof contactInput>;

// ---------------------------------------------------------------------------------------------
// Pictures

export type ImageType = 'image/webp' | 'image/jpeg' | 'image/png';
/** The picture's real type from its first bytes (never the name or the browser's word). */
export function sniffImage(b: Uint8Array): ImageType | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  const ascii = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  return null;
}
