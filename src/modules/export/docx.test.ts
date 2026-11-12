import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import * as F from '@/modules/resume/fixtures';
import { buildDocx } from './docx';

async function documentXml(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  return {
    xml: (await zip.file('word/document.xml')!.async('string')) as string,
    rels: (await zip.file('word/_rels/document.xml.rels')!.async('string')) as string,
  };
}
const plain = (xml: string) =>
  xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&');

describe('Word export', () => {
  it('keeps every section in order, with real bullets, headings and links', async () => {
    const { xml, rels } = await documentXml(await buildDocx(F.driver));
    const text = plain(xml);
    const at = (s: string) => {
      const i = text.indexOf(s);
      expect(i, s).toBeGreaterThan(-1);
      return i;
    };
    expect(at('Imran Qureshi')).toBeLessThan(at('Multi-drop Van Driver'));
    expect(at('Deliver around 120 parcels a day')).toBeLessThan(at('Courier Driver'));
    expect(at('Courier Driver')).toBeLessThan(at('GCSEs including English'));
    expect(xml).toContain('w:numPr'); // Word bullets, not typed "•"
    expect(xml).toContain('w:pStyle w:val="Heading1"');
    expect(rels).toContain('mailto:imran.qureshi@example.com');
    expect(xml).toContain(F.driver.design.accent.slice(1).toUpperCase());
  });

  it('uses the CV paper size', async () => {
    const letter = { ...F.driver, design: { ...F.driver.design, pageSize: 'Letter' as const } };
    const { xml } = await documentXml(await buildDocx(letter));
    expect(xml).toMatch(/w:pgSz w:w="12240"/);
    const { xml: a4 } = await documentXml(await buildDocx(F.driver));
    expect(a4).toMatch(/w:pgSz w:w="11906"/);
  });

  it('works for every fixture, including an empty one', async () => {
    for (const d of Object.values(F).filter(
      (x): x is typeof F.driver => !!x && typeof x === 'object' && 'basics' in x,
    ))
      expect((await buildDocx(d)).subarray(0, 2).toString()).toBe('PK');
  });
});
