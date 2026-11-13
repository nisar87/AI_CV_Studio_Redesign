import { applyV1Change, designSpec, migrateV1, toV1 } from '@/modules/design/catalogue';
import { DESIGN_META, isSpecDesign } from '@/modules/design/designs';
import type { DesignSpecV2 } from '@/modules/design/spec';
import { newId } from './create';
import type { Basics, DesignId, DesignSpec, ResumeDocument, Section, SectionKind } from './schema';

/**
 * Pure document operations. Every edit in the UI goes through one of these, which keeps
 * undo/redo, autosave and tests simple. All functions return a new document.
 */

type Item = Section['items'][number];

const touch = (doc: ResumeDocument, patch: Partial<ResumeDocument>): ResumeDocument => ({
  ...doc,
  ...patch,
});

function move<T>(xs: T[], from: number, to: number): T[] {
  if (from < 0 || from >= xs.length || to < 0 || to >= xs.length || from === to) return xs;
  const out = xs.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x!);
  return out;
}

function mapSection(
  doc: ResumeDocument,
  sectionId: string,
  fn: (s: Section) => Section,
): ResumeDocument {
  return touch(doc, { sections: doc.sections.map((s) => (s.id === sectionId ? fn(s) : s)) });
}

export function emptyItem(kind: SectionKind): Item {
  const id = newId();
  switch (kind) {
    case 'experience':
    case 'volunteering':
      return {
        id,
        role: '',
        organization: '',
        location: '',
        start: '',
        end: '',
        current: false,
        bullets: [],
      };
    case 'education':
      return {
        id,
        qualification: '',
        institution: '',
        location: '',
        start: '',
        end: '',
        details: [],
      };
    case 'skills':
      return { id, label: '', keywords: [] };
    case 'languages':
      return { id, language: '', fluency: '' };
    case 'certifications':
    case 'licences':
    case 'awards':
      return { id, name: '', issuer: '', date: '', detail: '' };
    case 'projects':
      return { id, name: '', role: '', link: '', start: '', end: '', bullets: [] };
    case 'custom':
    case 'achievements':
      return { id, title: '', subtitle: '', date: '', bullets: [] };
    case 'publications':
    case 'courses':
    case 'memberships':
    case 'conferences':
    case 'patents':
      return { id, name: '', issuer: '', date: '', detail: '', link: '' };
    case 'military':
    case 'internships':
      return {
        id,
        role: '',
        organization: '',
        location: '',
        start: '',
        end: '',
        current: false,
        bullets: [],
      };
    case 'interests':
      return { id, label: '', keywords: [] };
    case 'references':
      return { id, name: '', role: '', organization: '', contact: '' };
    case 'strengths':
      return { id, title: '', text: '' };
    case 'testimonials':
      return { id, quote: '', name: '', role: '' };
    case 'personalDetails':
      return { id, label: '', value: '' };
    case 'declaration':
      return {
        id,
        text: 'I hereby declare that the information given above is true to the best of my knowledge.',
        place: '',
        date: '',
      };
  }
}

export const ops = {
  rename(doc: ResumeDocument, title: string) {
    return touch(doc, { title });
  },
  updateBasics(doc: ResumeDocument, patch: Partial<Basics>) {
    return touch(doc, { basics: { ...doc.basics, ...patch } });
  },
  addLink(doc: ResumeDocument) {
    return ops.updateBasics(doc, {
      links: [...doc.basics.links, { id: newId(), label: '', url: '' }],
    });
  },
  updateLink(doc: ResumeDocument, linkId: string, patch: { label?: string; url?: string }) {
    return ops.updateBasics(doc, {
      links: doc.basics.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    });
  },
  removeLink(doc: ResumeDocument, linkId: string) {
    return ops.updateBasics(doc, { links: doc.basics.links.filter((l) => l.id !== linkId) });
  },

  addSection(
    doc: ResumeDocument,
    kind: SectionKind,
    title: string,
    index = doc.sections.length,
  ): { doc: ResumeDocument; sectionId: string } {
    const section = {
      id: newId(),
      kind,
      title,
      hidden: false,
      items: [emptyItem(kind)],
    } as Section;
    const sections = doc.sections.slice();
    sections.splice(index, 0, section);
    return { doc: touch(doc, { sections }), sectionId: section.id };
  },
  removeSection(doc: ResumeDocument, sectionId: string) {
    return touch(doc, { sections: doc.sections.filter((s) => s.id !== sectionId) });
  },
  moveSection(doc: ResumeDocument, sectionId: string, delta: -1 | 1) {
    const i = doc.sections.findIndex((s) => s.id === sectionId);
    return touch(doc, { sections: move(doc.sections, i, i + delta) });
  },
  renameSection(doc: ResumeDocument, sectionId: string, title: string) {
    return mapSection(doc, sectionId, (s) => ({ ...s, title }));
  },
  setSectionHidden(doc: ResumeDocument, sectionId: string, hidden: boolean) {
    return mapSection(doc, sectionId, (s) => ({ ...s, hidden }));
  },

  addItem(doc: ResumeDocument, sectionId: string): { doc: ResumeDocument; itemId: string } {
    let itemId = '';
    const next = mapSection(doc, sectionId, (s) => {
      const item = emptyItem(s.kind);
      itemId = item.id;
      return { ...s, items: [...s.items, item] } as Section;
    });
    return { doc: next, itemId };
  },
  updateItem(
    doc: ResumeDocument,
    sectionId: string,
    itemId: string,
    patch: Record<string, unknown>,
  ) {
    return mapSection(
      doc,
      sectionId,
      (s) =>
        ({
          ...s,
          items: s.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
        }) as Section,
    );
  },
  removeItem(doc: ResumeDocument, sectionId: string, itemId: string) {
    return mapSection(
      doc,
      sectionId,
      (s) => ({ ...s, items: s.items.filter((it) => it.id !== itemId) }) as Section,
    );
  },
  moveItem(doc: ResumeDocument, sectionId: string, itemId: string, delta: -1 | 1) {
    return mapSection(doc, sectionId, (s) => {
      const i = s.items.findIndex((it) => it.id === itemId);
      return { ...s, items: move(s.items as Item[], i, i + delta) } as Section;
    });
  },

  setDesign(doc: ResumeDocument, patch: Partial<DesignSpec>) {
    const { v2, ...v1 } = doc.design;
    const next = { ...v1, ...patch, options: { ...v1.options, ...(patch.options ?? {}) } };
    if (!v2) return touch(doc, { design: next });
    // A design with a v2 spec stays in step: picking a catalogue design re-attaches to it.
    // Picking a catalogue design re-attaches, also when the v1 id is unchanged (a spec-only or
    // custom design is stored with the v1 id of its family's hand-crafted design).
    const repick =
      !!patch.templateId && (patch.templateId !== v1.templateId || !!v2.designId || !v2.baseId);
    const spec = repick ? migrateV1(next) : applyV1Change(v2, next, patch);
    return touch(doc, { design: { ...next, v2: spec } });
  },
  /** Switch to a catalogue design (any of the 32); the words and the person's colour stay. */
  useDesign(doc: ResumeDocument, id: DesignId) {
    if (!isSpecDesign(id)) {
      const font = DESIGN_META[id].fontPair;
      return ops.setDesign(doc, { templateId: id, ...(font ? { fontPair: font } : {}) });
    }
    const { v2: _old, ...v1 } = doc.design;
    void _old;
    return ops.setSpec(doc, designSpec(id, v1));
  },
  /** Set the Design Spec v2 (Design Studio); the v1 fields follow it. */
  setSpec(doc: ResumeDocument, spec: DesignSpecV2) {
    const { v2: _old, ...v1 } = doc.design;
    void _old;
    return touch(doc, { design: { ...toV1(spec, v1), v2: spec } });
  },
  /** Back to the plain catalogue design (drops the v2 spec). */
  clearSpec(doc: ResumeDocument) {
    const { v2: _old, ...v1 } = doc.design;
    void _old;
    return touch(doc, { design: v1 });
  },
};

/** Duplicate a document with fresh ids. */
export function duplicateDocument(doc: ResumeDocument, now = new Date()): ResumeDocument {
  const iso = now.toISOString();
  return {
    ...structuredClone(doc),
    id: newId(),
    title: `${doc.title} (copy)`,
    createdAt: iso,
    updatedAt: iso,
  };
}
