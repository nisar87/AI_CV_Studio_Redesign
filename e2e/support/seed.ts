import type { Page } from '@playwright/test';
import type { ResumeDocument } from '../../src/modules/resume/schema';

/** Put a CV into this browser's storage before the page loads (once). */
export async function seedDocument(page: Page, doc: ResumeDocument) {
  await page.addInitScript((d) => {
    if (!localStorage.getItem(`cvstudio:v1:doc:${d.id}`))
      localStorage.setItem(`cvstudio:v1:doc:${d.id}`, JSON.stringify(d));
  }, doc);
}
