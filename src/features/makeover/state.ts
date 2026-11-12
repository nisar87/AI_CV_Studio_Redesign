'use client';

import type { Coverage } from '@/modules/import/coverage';
import type { ImportKind } from '@/modules/import/extract';
import type { ImportReport } from '@/modules/import/parse';
import type { Chip } from '@/modules/makeover/polish';
import type { Profile } from '@/modules/makeover/profile';
import type { ContentStats, Ranked } from '@/modules/makeover/rank';
import type { ResumeDocument, TemplateId } from '@/modules/resume/schema';

/** What /api/makeover returns. */
export type MakeoverResult = {
  makeoverId: string;
  mode: 'full' | 'preview';
  previewFor: 'visitor' | 'limit' | null;
  document: ResumeDocument;
  report: ImportReport;
  method: 'ai' | 'rules';
  kind: ImportKind;
  scanned: boolean;
  photo: boolean;
  lines: string[];
  coverage: Coverage;
  profile: Profile;
  stats: ContentStats;
  ranking: Ranked[];
  counts: Record<Chip, number>;
  ai: boolean;
};

export const ACCEPT =
  '.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/heic,image/heif';
export const ACCEPT_RE = /\.(pdf|docx|doc|jpe?g|png|webp|heic|heif)$/i;
export const MAX_BYTES = 10 * 1024 * 1024;

/** Checks the browser can do before uploading (the server checks the bytes again). */
export function fileProblem(f: File): string | null {
  if (!ACCEPT_RE.test(f.name) && !/^image\//.test(f.type))
    return 'Please choose a PDF, a Word file (.docx or .doc) or a photo of your CV (JPG, PNG or HEIC).';
  if (f.size > MAX_BYTES) return 'That file is larger than 10 MB. Please choose a smaller file.';
  if (f.size === 0) return 'That file is empty.';
  return null;
}

// A file chosen on the home page, handed to /makeover by client-side navigation.
let handoff: File | null = null;
export function handOff(f: File) {
  handoff = f;
}
export function takeHandOff(): File | null {
  const f = handoff;
  handoff = null;
  return f;
}

/** A makeover kept through sign-in / sign-up (this browser only, for a day). */
export type Pending = {
  result: MakeoverResult;
  doc: ResumeDocument;
  templateId: TemplateId;
  action: 'download' | 'edit';
  at: number;
};
const KEY = 'cvs_makeover';
const DAY = 86_400_000;

export function savePending(p: Omit<Pending, 'at'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {
    // Storage full or blocked: the person can upload again after signing in.
  }
}
export function loadPending(): Pending | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (!p?.result?.makeoverId || Date.now() - p.at > DAY) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}
export function clearPending() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
