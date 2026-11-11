'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { PresetId } from '@/modules/resume/professions';
import { DescribeBox } from './describe-box';
import { ProfessionPicker } from './profession-picker';

export function StartFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<PresetId | null>(null);

  function choose(id: PresetId) {
    setBusy(id);
    const design = params.get('design');
    router.push(`/cv/new?work=${id}${design ? `&design=${encodeURIComponent(design)}` : ''}`);
  }

  return (
    <>
      <DescribeBox onCreate={(href) => router.push(href)} />
      <ProfessionPicker onChoose={choose} busy={busy} />
    </>
  );
}
