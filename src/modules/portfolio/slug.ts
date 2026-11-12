/** Rules for portfolio addresses (aicvstudio.app/p/{slug}). Shared by browser and server. */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'about',
  'account',
  'help',
  'support',
  'premium',
  'pricing',
  'privacy',
  'terms',
  'jobs',
  'cv',
  'cvs',
  'profile',
  'portfolio',
  'linkedin',
  'signin',
  'login',
  'signup',
  'start',
  'templates',
  'designs',
  'aicvstudio',
  'ai-cv-studio',
  'www',
  'static',
  'test',
]);

export function suggestSlug(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** null when fine, otherwise a plain-language problem. */
export function slugProblem(slug: string): string | null {
  if (slug.length < 3) return 'Use at least 3 characters.';
  if (slug.length > 40) return 'Use 40 characters or fewer.';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return 'Use lowercase letters, numbers and single hyphens only.';
  if (RESERVED_SLUGS.has(slug)) return 'That address is reserved. Please choose another.';
  return null;
}
