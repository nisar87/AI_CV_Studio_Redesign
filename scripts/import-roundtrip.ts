/**
 * Import quality check: re-imports the PDFs our own designs produce (artifacts/visual/templates,
 * from `npm run qa:templates`) and compares the result with the source CV.
 * Usage: npx tsx scripts/import-roundtrip.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { extractLines } from '../src/modules/import/extract';
import { parseCv } from '../src/modules/import/parse';
import { FIXTURES } from '../src/modules/resume/fixtures';
import { TEMPLATE_IDS, type ResumeDocument } from '../src/modules/resume/schema';

const count = (d: ResumeDocument, kind: string) =>
  d.sections.filter((s) => s.kind === kind && !s.hidden).reduce((n, s) => n + s.items.length, 0);
const keywords = (d: ResumeDocument) =>
  d.sections.flatMap((s) => (s.kind === 'skills' ? s.items.flatMap((i) => i.keywords) : []));

async function main() {
  let checks = 0;
  let passed = 0;
  const fails: string[] = [];
  for (const t of TEMPLATE_IDS)
    for (const [fx, src] of Object.entries(FIXTURES)) {
      const file = `artifacts/visual/templates/${t}-${fx}.pdf`;
      if (!existsSync(file) || fx === 'extreme') continue;
      const { lines } = await extractLines(new Uint8Array(readFileSync(file)), file);
      const { doc } = parseCv(lines);
      const want = {
        name: src.basics.name,
        email: src.basics.email,
        phone: src.basics.phone,
        jobs: count(src, 'experience'),
        schools: count(src, 'education'),
        skills: keywords(src).length,
      };
      const got = {
        name: doc.basics.name,
        email: doc.basics.email,
        phone: doc.basics.phone,
        jobs: count(doc, 'experience'),
        schools: count(doc, 'education'),
        skills: keywords(doc).length,
      };
      for (const k of Object.keys(want) as (keyof typeof want)[]) {
        checks++;
        if (String(want[k]) === String(got[k])) passed++;
        else
          fails.push(
            `${t}-${fx} ${k}: want ${JSON.stringify(want[k])} got ${JSON.stringify(got[k])}`,
          );
      }
    }
  console.log(fails.join('\n'));
  console.log(`\n${passed}/${checks} checks passed (${((passed / checks) * 100).toFixed(1)}%)`);
}
void main();
