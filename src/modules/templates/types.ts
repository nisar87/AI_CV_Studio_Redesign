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
  /** Whether the design can show a profile photo. */
  photo: 'none' | 'optional';
  /** Where contact details go: the header (default) or the top of the side column. */
  contactsIn?: 'header' | 'aside';
  /** Renders the contact block when contactsIn is 'aside'. */
  AsideContact?: (props: TemplateComponentProps) => ReactNode;
  /** Decorative art drawn behind content on every page (purely visual). */
  Decor?: (props: TemplateComponentProps) => ReactNode;
  /** Short tags shown in the design picker. */
  tags: string[];
  /** Section kinds placed in the side column. Empty = single column. */
  asideKinds: SectionKind[];
  css: string;
  hooks: TemplateHooks;
  Header: (props: TemplateComponentProps) => ReactNode;
  /** Slim header for continuation pages. */
  Running?: (props: TemplateComponentProps) => ReactNode;
};
