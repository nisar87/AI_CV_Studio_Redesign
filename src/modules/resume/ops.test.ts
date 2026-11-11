import { describe, expect, it } from 'vitest';
import { BrowserDocumentRepository, MemoryStore } from '@/modules/storage/repository';
import { createDocument } from './create';
import { FIXTURES } from './fixtures';
import { duplicateDocument, ops } from './ops';
import { parseResumeDocument } from './schema';

describe('ops', () => {
  it('adds, edits, moves and removes items without touching other sections', () => {
    let doc = createDocument('driver');
    const exp = doc.sections[0]!;
    const a = ops.addItem(doc, exp.id);
    doc = ops.updateItem(a.doc, exp.id, a.itemId, { role: 'Driver' });
    const b = ops.addItem(doc, exp.id);
    doc = ops.updateItem(b.doc, exp.id, b.itemId, { role: 'Courier' });
    doc = ops.moveItem(doc, exp.id, b.itemId, -1);
    const items = doc.sections[0]!.items as { role: string }[];
    expect(items.map((i) => i.role)).toEqual(['Courier', 'Driver']);
    doc = ops.removeItem(doc, exp.id, a.itemId);
    expect(doc.sections[0]!.items).toHaveLength(1);
    expect(doc.sections.slice(1)).toEqual(
      createDocument('driver')
        .sections.slice(1)
        .map((s, i) => ({ ...s, id: doc.sections[i + 1]!.id })),
    );
    expect(() => parseResumeDocument(doc)).not.toThrow();
  });

  it('moves sections and ignores moves past the ends', () => {
    const doc = createDocument('teacher');
    const first = doc.sections[0]!.id;
    expect(ops.moveSection(doc, first, -1).sections[0]!.id).toBe(first);
    expect(ops.moveSection(doc, first, 1).sections[1]!.id).toBe(first);
  });

  it('adds a section with one empty item ready to fill', () => {
    const { doc, sectionId } = ops.addSection(createDocument('general'), 'languages', 'Languages');
    const s = doc.sections.find((x) => x.id === sectionId)!;
    expect(s.kind).toBe('languages');
    expect(s.items).toHaveLength(1);
  });

  it('never mutates the input document', () => {
    const doc = structuredClone(FIXTURES.teacher);
    const frozen = JSON.stringify(doc);
    ops.setDesign(doc, { templateId: 'heritage', options: { headerAlign: 'center' } });
    ops.updateBasics(doc, { name: 'X' });
    ops.removeSection(doc, doc.sections[0]!.id);
    expect(JSON.stringify(doc)).toBe(frozen);
  });

  it('duplicates with a new id', () => {
    const copy = duplicateDocument(FIXTURES.driver);
    expect(copy.id).not.toBe(FIXTURES.driver.id);
    expect(copy.title).toContain('(copy)');
    expect(copy.sections).toEqual(FIXTURES.driver.sections);
  });
});

describe('BrowserDocumentRepository', () => {
  it('saves, lists newest first, and removes', () => {
    const repo = new BrowserDocumentRepository(new MemoryStore());
    const a = { ...FIXTURES.driver, id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' };
    const b = { ...FIXTURES.teacher, id: 'b', updatedAt: '2026-02-01T00:00:00.000Z' };
    repo.save(a);
    repo.save(b);
    expect(repo.list().map((d) => d.id)).toEqual(['b', 'a']);
    expect(repo.get('a')?.basics.name).toBe('Imran Qureshi');
    repo.remove('a');
    expect(repo.list()).toHaveLength(1);
  });

  it('quarantines corrupt documents instead of crashing or deleting them', () => {
    const store = new MemoryStore();
    store.setItem('cvstudio:v1:doc:bad', '{"not":"a cv"}');
    const repo = new BrowserDocumentRepository(store);
    expect(repo.list()).toEqual([]);
    expect(store.getItem('cvstudio:v1:quarantine:bad')).toBe('{"not":"a cv"}');
  });

  it('round-trips a backup and never overwrites existing documents', () => {
    const repo = new BrowserDocumentRepository(new MemoryStore());
    repo.save(FIXTURES.driver);
    const backup = JSON.parse(JSON.stringify(repo.exportAll()));
    const result = repo.importAll(backup);
    expect(result).toEqual({ added: 1, skipped: 0 });
    expect(repo.list()).toHaveLength(2);
    expect(() => repo.importAll({ hello: 1 })).toThrow(/not an AI CV Studio backup/);
  });
});
