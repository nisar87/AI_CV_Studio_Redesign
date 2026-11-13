import type { DesignId, DesignSpec, ResumeDocument } from '@/modules/resume/schema';
import { currentDesignId, designSpec, migrateV1 } from './catalogue';
import { DESIGNS } from './designs';
import { parseSpec, type DesignSpecV2 } from './spec';
import { applyFlat, toFlat, type FieldName } from './vocab';

/**
 * The AI Designer's pure side (complete-studio-spec §7.4): content statistics for the prompt,
 * turning the model's flat choices into Design Specs, refine patches, and the nearest catalogue
 * design. Nothing the model returns reaches the composer except through parseSpec.
 */

export type ComposeCandidate = {
  name: string;
  explanation: string;
  startFrom: DesignId;
  choices: Record<string, unknown>;
  unmet: string[];
};

export type Candidate = {
  name: string;
  explanation: string;
  unmet: string[];
  spec: DesignSpecV2;
  /** The catalogue design it starts from (or is, when nothing was changed). */
  startFrom: DesignId;
};

/** Content statistics only — no CV text goes to the design model. */
export function designStats(doc: ResumeDocument) {
  const sections = doc.sections
    .filter((s) => !s.hidden && s.items.length)
    .map((s) => ({
      kind: s.kind,
      items: s.items.length,
      chars: JSON.stringify(s.items).replace(/"id":"[^"]*"/g, '').length,
    }));
  const chars = sections.reduce((n, s) => n + s.chars, 0) + doc.basics.summary.length;
  return {
    pages: Math.max(1, Math.round((chars / 3200) * 10) / 10),
    sections,
    hasPhoto: !!doc.basics.photo,
  };
}

/** A spec without its catalogue attachment (it is now the person's own design). */
function detach(spec: DesignSpecV2, from: DesignId): DesignSpecV2 {
  return { ...spec, baseId: undefined, designId: undefined, origin: from };
}

const same = (a: DesignSpecV2, b: DesignSpecV2) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A model candidate as a Design Spec: the catalogue design it starts from (with the person's own
 * paper size and colour), plus the changed fields. Unchanged → still that catalogue design.
 */
export function candidateSpec(c: ComposeCandidate, current: DesignSpec): Candidate {
  const start = designSpec(c.startFrom, current);
  const { spec } = applyFlat(start, c.choices);
  const out = same(spec, start) ? start : detach(spec, c.startFrom);
  out.page = { ...out.page, size: current.pageSize };
  return {
    name: c.name.trim() || 'Your design',
    explanation: c.explanation.trim(),
    unmet: c.unmet.map((u) => u.trim()).filter(Boolean),
    spec: out,
    startFrom: c.startFrom,
  };
}

/** Candidates, first one first, without duplicates. */
export function candidateSpecs(list: ComposeCandidate[], current: DesignSpec): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of list) {
    const cand = candidateSpec(c, current);
    const key = JSON.stringify({ ...cand.spec, origin: undefined });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cand);
  }
  return out;
}

/** The catalogue design most like a spec (most flat fields in common): the safe fallback. */
export function nearestCatalogue(spec: DesignSpecV2, current: DesignSpec): DesignId {
  const want = toFlat(spec);
  let best: DesignId = 'clarity';
  let bestScore = -1;
  for (const d of DESIGNS) {
    const f = toFlat(designSpec(d.id, current));
    let score = 0;
    for (const k of Object.keys(want) as FieldName[])
      if (JSON.stringify(f[k]) === JSON.stringify(want[k]))
        score += k === 'layout' || k === 'header' ? 4 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = d.id;
    }
  }
  return best;
}

/** The spec a CV is in now (v1 CVs: their catalogue design as a spec). */
export function specOf(d: DesignSpec): DesignSpecV2 {
  return d.v2 ?? migrateV1(d);
}

/**
 * Apply a refine patch. Only the named fields change (asserted in tests); anything that is not a
 * known field or a valid value is skipped and reported.
 */
export function applyRefine(
  spec: DesignSpecV2,
  changes: { field: string; value: string }[],
  current: DesignSpec,
): { spec: DesignSpecV2; applied: FieldName[]; skipped: string[] } {
  const r = applyFlat(spec, Object.fromEntries(changes.map((c) => [c.field, c.value])));
  if (same(r.spec, spec)) return { ...r, spec };
  const from = currentDesignId({ ...current, v2: spec }) ?? spec.origin ?? current.templateId;
  return { ...r, spec: detach(r.spec, from) };
}

/** The flat fields sent to the model as "current design". */
export function currentForPrompt(d: DesignSpec) {
  const s = specOf(d);
  return { current: toFlat(s), currentDesign: currentDesignId(d) ?? undefined };
}

export { parseSpec };
