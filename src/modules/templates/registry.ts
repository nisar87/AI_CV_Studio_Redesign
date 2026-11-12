import type { TemplateId } from '@/modules/resume/schema';
import { atelier } from './library/atelier';
import { chronicle } from './library/chronicle';
import { clarity } from './library/clarity';
import { folio } from './library/folio';
import { halo } from './library/halo';
import { heritage } from './library/heritage';
import { ledger } from './library/ledger';
import { meridian } from './library/meridian';
import { sprout } from './library/sprout';
import { vivid } from './library/vivid';
import type { CatalogueTemplate } from './types';

export const TEMPLATES: Record<TemplateId, CatalogueTemplate> = {
  clarity,
  meridian,
  heritage,
  atelier,
  ledger,
  chronicle,
  vivid,
  folio,
  halo,
  sprout,
};

/** Display order in pickers: a spread of styles, safest first. */
export const TEMPLATE_LIST: CatalogueTemplate[] = [
  clarity,
  atelier,
  ledger,
  meridian,
  chronicle,
  vivid,
  halo,
  folio,
  sprout,
  heritage,
];

export function getTemplate(id: TemplateId): CatalogueTemplate {
  return TEMPLATES[id] ?? clarity;
}
