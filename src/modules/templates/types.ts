import type { ReactNode } from 'react';
import type { SectionKind, TemplateId } from '@/modules/resume/schema';
import type { TemplateComponentProps, TemplateHooks } from './blocks';
import type { TemplateOptionSupport } from './design';

export type TemplateDefinition = {
  id: TemplateId;
  /** Shown to users. */
  name: string;
  /** Plain-language description; also given to AI design interpretation. */
  description: string;
  /** Style card label in the Design panel. */
  style: string;
  support: TemplateOptionSupport;
  /** Section kinds placed in the side column. Empty = single column. */
  asideKinds: SectionKind[];
  css: string;
  hooks: TemplateHooks;
  Header: (props: TemplateComponentProps) => ReactNode;
  /** Slim header for continuation pages. */
  Running?: (props: TemplateComponentProps) => ReactNode;
};
