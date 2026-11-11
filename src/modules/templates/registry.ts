import type { TemplateId } from '@/modules/resume/schema';
import { clarity } from './library/clarity';
import { heritage } from './library/heritage';
import { meridian } from './library/meridian';
import type { TemplateDefinition } from './types';

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = { clarity, meridian, heritage };
export const TEMPLATE_LIST: TemplateDefinition[] = [clarity, meridian, heritage];

export function getTemplate(id: TemplateId): TemplateDefinition {
  return TEMPLATES[id] ?? clarity;
}
