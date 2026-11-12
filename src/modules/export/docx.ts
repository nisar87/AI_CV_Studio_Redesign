import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  type ParagraphChild,
} from 'docx';
import type { ResumeDocument } from '@/modules/resume/schema';
import { FONT_PAIRS } from '@/modules/templates/fonts';
import { toRenderModel, type REntry, type RSection } from '@/modules/templates/render-model';

/**
 * A Word version of a CV: one clean column with real headings, bullets and links, so it opens
 * well in Word, Google Docs and applicant-tracking systems and is easy to edit. It follows the
 * CV's accent colour, paper size and heading style (serif or sans) with fonts every computer has.
 */
const MM = 56.6929; // twips per mm
const PAGE = { A4: { w: 210, h: 297 }, Letter: { w: 215.9, h: 279.4 } } as const;
const BODY_FONT = 'Calibri';
const INK = '1F2328';
const MUTED = '57606A';

export async function buildDocx(doc: ResumeDocument): Promise<Buffer> {
  const m = toRenderModel(doc);
  const pair = FONT_PAIRS[doc.design.fontPair];
  const headingFont =
    /serif/i.test(pair.headingFallback) && !/sans/i.test(pair.headingFallback)
      ? 'Georgia'
      : BODY_FONT;
  const accent = doc.design.accent.replace('#', '').toUpperCase();
  const page = PAGE[doc.design.pageSize];
  const contentTwips = Math.round((page.w - 36) * MM);

  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: m.name || 'Your name',
          font: headingFont,
          size: 44,
          bold: true,
          color: INK,
        }),
      ],
    }),
  );
  if (m.headline)
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: m.headline, size: 24, color: accent, bold: true })],
      }),
    );
  if (m.contacts.length) {
    const parts: ParagraphChild[] = [];
    m.contacts.forEach((c, i) => {
      if (i) parts.push(new TextRun({ text: '  ·  ', color: MUTED }));
      const run = new TextRun({ text: c.text, color: c.href ? accent : MUTED, size: 19 });
      parts.push(c.href ? new ExternalHyperlink({ link: c.href, children: [run] }) : run);
    });
    children.push(new Paragraph({ spacing: { after: 120 }, children: parts }));
  }

  for (const s of m.sections) {
    if (s.kind === 'contact') continue;
    children.push(sectionHeading(s.title, headingFont, accent));
    if (s.text) children.push(body(s.text));
    for (const e of s.entries) children.push(...entry(s, e, contentTwips));
  }

  const file = new Document({
    creator: 'AI CV Studio',
    title: doc.title || `${m.name} CV`,
    description: 'CV',
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: 21, color: INK },
          paragraph: { spacing: { after: 60, line: 264 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'cv-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } }, run: { color: accent } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(page.w * MM), height: Math.round(page.h * MM) },
            margin: { top: 16 * MM, bottom: 16 * MM, left: 18 * MM, right: 18 * MM },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(file);
}

function sectionHeading(title: string, font: string, accent: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } },
    children: [new TextRun({ text: title, font, size: 25, bold: true, color: accent })],
  });
}

const body = (text: string) => new Paragraph({ children: [new TextRun({ text })] });

function entry(s: RSection, e: REntry, width: number): Paragraph[] {
  const out: Paragraph[] = [];
  if (s.kind === 'skills') {
    const runs: TextRun[] = [];
    if (e.label) runs.push(new TextRun({ text: `${e.label}: `, bold: true }));
    runs.push(new TextRun({ text: e.tags.join(', ') }));
    return [new Paragraph({ children: runs })];
  }
  if (s.kind === 'languages')
    return [
      new Paragraph({
        children: [
          new TextRun({ text: e.title, bold: true }),
          ...(e.label ? [new TextRun({ text: ` — ${e.label}`, color: MUTED })] : []),
        ],
      }),
    ];

  const title = e.title || e.subtitle;
  const sub = e.title ? [e.subtitle, e.meta].filter(Boolean).join(', ') : e.meta;
  out.push(
    new Paragraph({
      keepNext: true,
      spacing: { before: 120, after: 20 },
      tabStops: [{ type: TabStopType.RIGHT, position: width }],
      children: [
        new TextRun({ text: title, bold: true, size: 22 }),
        ...(e.dates ? [new TextRun({ text: `\t${e.dates}`, color: MUTED, size: 19 })] : []),
      ],
    }),
  );
  if (sub) {
    const run = new TextRun({ text: sub, italics: true, color: MUTED });
    out.push(
      new Paragraph({
        keepNext: e.bullets.length > 0,
        spacing: { after: 40 },
        children: [
          e.metaHref && sub === e.meta
            ? new ExternalHyperlink({ link: e.metaHref, children: [run] })
            : run,
        ],
      }),
    );
  }
  for (const b of e.bullets)
    out.push(
      new Paragraph({
        numbering: { reference: 'cv-bullets', level: 0 },
        spacing: { after: 30 },
        children: [new TextRun({ text: b })],
      }),
    );
  return out;
}
