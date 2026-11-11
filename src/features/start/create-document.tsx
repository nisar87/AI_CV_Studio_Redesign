'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createDocument } from '@/modules/resume/create';
import { PRESET_IDS, type PresetId } from '@/modules/resume/professions';
import {
  DENSITIES,
  FONT_PAIR_IDS,
  TEMPLATE_IDS,
  type Density,
  type FontPairId,
  type TemplateId,
} from '@/modules/resume/schema';
import { ensureContrast } from '@/modules/templates/color';
import { getRepository } from '@/modules/storage/repository';
import { StudioLoading } from '@/features/studio/with-document';

/** Creates a new CV from a profession preset (and optional design), then opens the guided flow. */
export function CreateDocument() {
  const router = useRouter();
  const params = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const work = params.get('work');
    const design = params.get('design');
    const preset: PresetId = PRESET_IDS.includes(work as PresetId) ? (work as PresetId) : 'general';
    // The interface and CV wording are English for now; keep the region for paper size and dates.
    const region = (navigator.language || '').split('-')[1]?.toUpperCase();
    const locale = `en-${region && /^[A-Z]{2}$/.test(region) ? region : 'GB'}`;
    const doc = createDocument(preset, { locale });
    if (TEMPLATE_IDS.includes(design as TemplateId)) doc.design.templateId = design as TemplateId;
    // From "Describe what you need" (validated; anything unexpected is ignored).
    const accent = params.get('accent');
    if (accent && /^#[0-9a-fA-F]{6}$/.test(accent))
      doc.design.accent = ensureContrast(accent.toLowerCase());
    const font = params.get('font');
    if (FONT_PAIR_IDS.includes(font as FontPairId)) doc.design.fontPair = font as FontPairId;
    const density = params.get('density');
    if (DENSITIES.includes(density as Density)) doc.design.density = density as Density;
    const title = params
      .get('title')
      ?.replace(/[{}<>]/g, '')
      .trim()
      .slice(0, 120);
    if (title) doc.basics.headline = title;
    getRepository().save(doc);
    router.replace(`/cv/${doc.id}/guided`);
  }, [params, router]);

  return <StudioLoading />;
}
