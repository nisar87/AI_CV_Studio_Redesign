'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PresetId } from '@/modules/resume/professions';
import { ProfessionPicker } from './profession-picker';

export function StartFlow() {
  const router = useRouter();
  const [busy, setBusy] = useState<PresetId | null>(null);

  function choose(id: PresetId) {
    setBusy(id);
    router.push(`/cv/new?work=${id}`);
  }

  return <ProfessionPicker onChoose={choose} busy={busy} />;
}
