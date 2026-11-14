import { describe, expect, it } from 'vitest';
import { designSpec, toV1 } from '@/modules/design/catalogue';
import { DESIGNS, FAMILIES } from '@/modules/design/designs';
import { contactEmail } from '@/modules/notify/server';
import { engineer } from '@/modules/resume/fixtures';
import type { ResumeDocument } from '@/modules/resume/schema';
import { MemoryUserStore } from '@/modules/store/memory';
import {
  contactInput,
  extrasInput,
  FAMILY_THEME,
  resolveTheme,
  sniffImage,
  THEMES,
  themeForDoc,
  usedImages,
  webLink,
} from './themes';

/** The sample CV in one catalogue design, as picking it in the editor would store it. */
function inDesign(id: (typeof DESIGNS)[number]['id']): ResumeDocument {
  const doc = structuredClone(engineer) as ResumeDocument;
  const v2 = designSpec(id, doc.design);
  doc.design = { ...toV1(v2, doc.design), v2 };
  return doc;
}

describe('portfolio themes', () => {
  it('has six themes, and every design family maps to one', () => {
    expect(THEMES).toHaveLength(6);
    for (const f of FAMILIES) expect(THEMES).toContain(FAMILY_THEME[f]);
    // The six themes are the six families that have their own (spec §10).
    for (const t of THEMES) expect(FAMILY_THEME[t]).toBe(t);
  });

  it('"Match my CV" follows the design family of every catalogue design', () => {
    for (const d of DESIGNS) expect(themeForDoc(inDesign(d.id))).toBe(FAMILY_THEME[d.family]);
  });

  it('a custom (Design Studio) design uses the design it started from', () => {
    const doc = inDesign(DESIGNS.find((d) => d.family === 'editorial')!.id);
    doc.design.v2 = {
      ...doc.design.v2!,
      designId: undefined,
      baseId: undefined,
      origin: doc.design.v2!.designId ?? doc.design.templateId,
    };
    expect(themeForDoc(doc)).toBe('editorial');
  });

  it('the page’s own choice wins over the CV', () => {
    const doc = inDesign(DESIGNS.find((d) => d.family === 'bold')!.id);
    expect(resolveTheme('auto', doc)).toBe('bold');
    expect(resolveTheme(undefined, doc)).toBe('bold');
    expect(resolveTheme('classic', doc)).toBe('classic');
  });
});

describe('portfolio extras input', () => {
  const ok = {
    theme: 'sidebar',
    sections: [{ id: 's1', title: '  What I’m   looking for ', text: 'Line\r\n\r\n\r\n\r\nNext‮' }],
    projects: [
      {
        id: 'p1',
        title: 'Shop site',
        text: '',
        link: 'example.com/shop',
        images: [{ id: 'img1', alt: 'Home page' }],
      },
    ],
    contact: true,
  };

  it('accepts and cleans a normal page', () => {
    const r = extrasInput.parse(ok);
    expect(r.theme).toBe('sidebar');
    expect(r.sections[0]!.title).toBe('What I’m looking for');
    expect(r.sections[0]!.text).toBe('Line\n\nNext');
    expect(r.sections[0]!.link).toBe('');
    expect(r.projects[0]!.link).toBe('https://example.com/shop');
    expect(r.contact).toBe(true);
    expect([...usedImages(r.projects)]).toEqual(['img1']);
  });

  it('fills defaults for a page saved before themes existed', () => {
    expect(extrasInput.parse({})).toEqual({
      theme: 'auto',
      sections: [],
      projects: [],
      contact: false,
    });
  });

  it('refuses unknown themes, too many items, untitled items and bad ids', () => {
    expect(extrasInput.safeParse({ ...ok, theme: 'neon' }).success).toBe(false);
    expect(
      extrasInput.safeParse({
        ...ok,
        sections: Array(7)
          .fill(ok.sections[0])
          .map((s, i) => ({ ...s, id: `s${i}` })),
      }).success,
    ).toBe(false);
    expect(
      extrasInput.safeParse({
        ...ok,
        projects: Array(9)
          .fill(ok.projects[0])
          .map((p, i) => ({ ...p, id: `p${i}` })),
      }).success,
    ).toBe(false);
    expect(
      extrasInput.safeParse({ ...ok, sections: [{ id: 's1', title: '  ', text: 'x' }] }).success,
    ).toBe(false);
    expect(
      extrasInput.safeParse({
        ...ok,
        projects: [{ ...ok.projects[0], images: Array(5).fill({ id: 'a', alt: '' }) }],
      }).success,
    ).toBe(false);
    expect(
      extrasInput.safeParse({ ...ok, projects: [{ ...ok.projects[0], id: '../x' }] }).success,
    ).toBe(false);
  });

  it('allows only web links on a public page', () => {
    expect(webLink.parse('https://a.example/x')).toBe('https://a.example/x');
    expect(webLink.parse('http://a.example')).toBe('http://a.example');
    expect(webLink.parse('github.com/me')).toBe('https://github.com/me');
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,hi',
      'mailto:a@b.co',
      'localhost',
      'not a link',
      'ftp://a.example',
    ])
      expect(webLink.safeParse(bad).success).toBe(false);
  });
});

describe('portfolio contact form', () => {
  it('needs a name, a real email and a message', () => {
    const ok = { name: 'Sara', email: 'sara@example.com', message: 'Hello' };
    expect(contactInput.parse({ ...ok, name: ' Sara\n K ' }).name).toBe('Sara K');
    expect(contactInput.safeParse({ ...ok, email: 'nope' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, message: '  ' }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, message: 'x'.repeat(2001) }).success).toBe(false);
    expect(contactInput.safeParse({ ...ok, name: '' }).success).toBe(false);
  });

  it('the email goes to the owner, marked as from a visitor, and a reply goes to the visitor', () => {
    const m = contactEmail('owner@example.com', {
      name: 'Sara <script>',
      email: 'sara@example.com',
      message: 'Hi <b>there</b>',
      slug: 'nisar',
    });
    expect(m.to).toBe('owner@example.com');
    expect(m.replyTo).toBe('sara@example.com');
    expect(m.subject).toContain('through your portfolio page');
    expect(m.text).toContain('Hi <b>there</b>');
    expect(m.text).toContain('/p/nisar');
    expect(m.text).toContain('We don’t check who sends messages');
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<b>there</b>');
    expect(m.html).toContain('&lt;b&gt;there&lt;/b&gt;');
  });
});

describe('portfolio pictures', () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(16).fill(0)]);
  it('knows a picture by its bytes, not its name', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))).toBe('image/png');
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(sniffImage(webp)).toBe('image/webp');
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe(
      null,
    );
    expect(sniffImage(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBe(null);
    expect(sniffImage(bytes(0x47, 0x49, 0x46, 0x38))).toBe(null); // GIF is not accepted
  });

  it('keeps pictures under the account; deleting the page or the account removes them', async () => {
    const store = new MemoryUserStore();
    const img = (id: string) => ({
      id,
      type: 'image/webp' as const,
      data: 'AAAA',
      bytes: 3,
      createdAt: '2026-11-14T00:00:00Z',
    });
    await store.putPortfolioImage('u1', img('a'));
    await store.putPortfolioImage('u1', img('b'));
    await store.putPortfolioImage('u2', img('c'));
    expect((await store.listPortfolioImages('u1')).map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(await store.listPortfolioImages('u1')).not.toContainEqual(
      expect.objectContaining({ data: 'AAAA' }),
    );
    expect(await store.getPortfolioImage('u2', 'a')).toBeNull();
    await store.deletePortfolioImage('u1', 'a');
    expect((await store.listPortfolioImages('u1')).map((i) => i.id)).toEqual(['b']);
    await store.deletePortfolioOf('u1');
    expect(await store.listPortfolioImages('u1')).toEqual([]);
    await store.deleteUserData('u2');
    expect(await store.listPortfolioImages('u2')).toEqual([]);
  });
});
