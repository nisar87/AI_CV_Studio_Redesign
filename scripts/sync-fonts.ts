// Copies the static CV font files (OFL-licensed) listed in src/modules/templates/font-catalog.ts
// from node_modules into public/fonts/cv. Static weights (not variable fonts) are used on purpose:
// Chrome embeds variable fonts in PDFs as Type 3 glyphs, static ones as TrueType (better for ATS).
// Run after changing the catalogue: `npm run fonts:sync`.
import fs from 'node:fs';
import path from 'node:path';
import { FONT_CATALOG as catalog } from '../src/modules/templates/font-catalog';

const OUT = 'public/fonts/cv';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const f of Object.values(catalog)) {
  for (const style of ['normal', 'italic'])
    for (const w of f[style as 'normal' | 'italic'])
      for (const subset of ['latin', 'latin-ext']) {
        const file = `${f.slug}-${subset}-${w}-${style}.woff2`;
        fs.copyFileSync(path.join('node_modules', f.pkg, 'files', file), path.join(OUT, file));
        n++;
      }
}
fs.writeFileSync(
  path.join(OUT, 'LICENSE.md'),
  'Fonts in this folder are licensed under the SIL Open Font License 1.1 (Inter, Inter Tight, Source Serif 4, Source Sans 3, Lora, Cormorant Garamond, IBM Plex Sans, Nunito Sans). Copied from @fontsource packages.\n',
);
console.log('fonts synced:', n, 'files');
