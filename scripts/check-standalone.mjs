// Every file in public/ must be in the standalone build, or production serves it as a 404
// (App Hosting runs the standalone server, which only ships traced files).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const missing = walk('public').filter((f) => !existsSync(join('.next/standalone', f)));
if (missing.length) {
  console.error(
    `Missing from the standalone build (add to outputFileTracingIncludes):\n${missing.join('\n')}`,
  );
  process.exit(1);
}
console.log(`OK: all ${walk('public').length} public files are in the standalone build.`);
