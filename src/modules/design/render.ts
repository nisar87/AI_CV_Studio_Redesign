import type { ResumeDocument } from '@/modules/resume/schema';
import { resolveDesign, type ResolvedDesign } from '@/modules/templates/design';
import { getTemplate } from '@/modules/templates/registry';
import type { TemplateDefinition } from '@/modules/templates/types';
import { toV1 } from './catalogue';
import { composeTemplate, resolveSpec } from './compose';
import { normalise } from './normalise';

export type DocumentDesign = {
  template: TemplateDefinition;
  design: ResolvedDesign;
  /** The document as rendered (an attached v2 spec is expressed as its v1 settings). */
  doc: ResumeDocument;
};

const cache = new Map<string, TemplateDefinition>();

/**
 * Which template and resolved design render this document — the single decision point for the
 * preview, the PDF and every test:
 *  - no v2 spec: the catalogue design from the v1 settings (unchanged behaviour);
 *  - a v2 spec attached to a catalogue design: that design's signature code, with the v2 values
 *    written back as v1 settings (identical output to the v1 document — tested);
 *  - any other v2 spec: normalised, then composed by the generic composer.
 */
export function documentDesign(doc: ResumeDocument): DocumentDesign {
  const v2 = doc.design.v2;
  if (v2 && !(v2.baseId && !v2.atsSafe)) {
    const { spec } = normalise(v2, doc);
    const key = JSON.stringify(spec);
    let template = cache.get(key);
    if (!template) {
      template = composeTemplate(spec);
      if (cache.size > 50) cache.clear();
      cache.set(key, template);
    }
    return { template, design: resolveSpec(spec), doc };
  }
  const d = v2 ? { ...doc, design: { ...toV1(v2, doc.design), v2 } } : doc;
  const template = getTemplate(d.design.templateId);
  return { template, design: resolveDesign(d.design, template.support), doc: d };
}
