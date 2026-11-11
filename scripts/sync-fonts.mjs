// Copies the CV template font files (OFL-licensed) from node_modules into public/fonts/cv.
// Run after changing the font catalogue in src/modules/templates/fonts.ts: `node scripts/sync-fonts.mjs`.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'public/fonts/cv';
const variable = [
  'inter',
  'inter-tight',
  'source-serif-4',
  'source-sans-3',
  'lora',
  'cormorant-garamond',
  'ibm-plex-sans',
];
fs.mkdirSync(OUT, { recursive: true });
for (const fam of variable) {
  for (const subset of ['latin', 'latin-ext']) {
    for (const style of ['normal', 'italic']) {
      const f = `${fam}-${subset}-wght-${style}.woff2`;
      fs.copyFileSync(
        path.join('node_modules/@fontsource-variable', fam, 'files', f),
        path.join(OUT, f),
      );
    }
  }
}
for (const subset of ['latin', 'latin-ext']) {
  for (const w of ['400', '700']) {
    for (const style of ['normal', 'italic']) {
      const f = `lato-${subset}-${w}-${style}.woff2`;
      fs.copyFileSync(path.join('node_modules/@fontsource/lato/files', f), path.join(OUT, f));
    }
  }
}
fs.writeFileSync(
  path.join(OUT, 'LICENSE.md'),
  'Fonts in this folder are licensed under the SIL Open Font License 1.1 (Inter, Inter Tight, Source Serif 4, Source Sans 3, Lora, Cormorant Garamond, IBM Plex Sans, Lato). Copied from @fontsource packages.\n',
);
console.log('fonts synced:', fs.readdirSync(OUT).length, 'files');
