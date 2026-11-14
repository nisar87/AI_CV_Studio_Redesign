import type {
  PortfolioProject,
  PortfolioSection,
  PortfolioTheme,
} from '@/modules/portfolio/themes';

/** The settings form, also handed to the preview tab through sessionStorage. */
export type PortfolioDraft = {
  slug: string;
  docId: string;
  published: boolean;
  showEmail: boolean;
  showPhone: boolean;
  theme: PortfolioTheme;
  sections: PortfolioSection[];
  projects: PortfolioProject[];
  contact: boolean;
};

const KEY = 'cvstudio:portfolio-draft';

export function saveDraft(d: PortfolioDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
    // localStorage too: a new tab opened with target=_blank gets a copy of sessionStorage only
    // in some browsers.
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {}
}

export function readDraft(): PortfolioDraft | null {
  try {
    const s = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as PortfolioDraft) : null;
  } catch {
    return null;
  }
}
