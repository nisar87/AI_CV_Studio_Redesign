/**
 * Makes src/modules/import/__fixtures__/linkedin-export.pdf: a two-column PDF laid out like
 * LinkedIn's "Save to PDF" export (contact, top skills, languages and certifications on the left;
 * name, headline, summary, experience and education on the right). The person is the driver
 * fixture, with a weaker profile than their CV (for the R9.9 review tests).
 *
 *   npx tsx scripts/linkedin-fixture.ts
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0 }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000 }
.page { display: grid; grid-template-columns: 34% 66%; min-height: 297mm }
.side { background: #f3f2ef; padding: 18mm 8mm 10mm 12mm; font-size: 10pt }
.main { padding: 18mm 14mm 10mm 10mm; font-size: 10pt }
h2 { font-size: 13pt; margin: 14pt 0 6pt }
h1 { font-size: 24pt; margin: 0 0 4pt; font-weight: normal }
.head { font-size: 12pt; margin: 0 0 4pt }
.loc { color: #555; margin: 0 0 12pt }
.co { font-size: 12pt; margin: 12pt 0 2pt }
.ti { font-weight: bold; margin: 0 }
.mu { color: #555; margin: 0 }
p { margin: 3pt 0 }
</style></head><body><div class="page">
<div class="side">
  <h2>Contact</h2>
  <p>imran.qureshi@example.com</p>
  <p>www.linkedin.com/in/imran-qureshi-4b2a91 (LinkedIn)</p>
  <h2>Top Skills</h2>
  <p>Driving</p><p>Customer Service</p><p>Time Management</p>
  <h2>Languages</h2>
  <p>English (Native or Bilingual)</p><p>Urdu (Professional Working)</p>
  <h2>Certifications</h2>
  <p>Driver CPC</p>
</div>
<div class="main">
  <h1>Imran Qureshi</h1>
  <p class="head">Driver at Swift Logistics</p>
  <p class="loc">Leicester, England, United Kingdom</p>
  <h2>Summary</h2>
  <p>Hard working driver looking for new opportunities.</p>
  <h2>Experience</h2>
  <p class="co">Swift Logistics</p>
  <p class="ti">Multi-drop Van Driver</p>
  <p class="mu">April 2019 - Present (5 years 8 months)</p>
  <p class="mu">Leicester, England, United Kingdom</p>
  <p>Delivering parcels.</p>
  <p class="co">CityLink Couriers</p>
  <p class="ti">Courier Driver</p>
  <p class="mu">February 2016 - March 2019 (3 years 2 months)</p>
  <p class="mu">Nottingham, England, United Kingdom</p>
  <h2>Education</h2>
  <p class="co">Beaumont Leys School</p>
  <p class="mu">GCSEs, English and Maths · (2011 - 2013)</p>
  <p class="mu" style="margin-top:40mm;text-align:center">Page 1 of 1</p>
</div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH });
const page = await browser.newPage();
await page.setContent(html);
const pdf = await page.pdf({ format: 'A4', printBackground: true });
await browser.close();
writeFileSync('src/modules/import/__fixtures__/linkedin-export.pdf', pdf);
console.log('wrote', pdf.byteLength, 'bytes');
