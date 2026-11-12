'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DropZone } from './drop-zone';
import { handOff } from './state';

/** The home page drop zone: hands the file to /makeover, which starts at once. */
export function LandingDrop() {
  const router = useRouter();
  useEffect(() => {
    // Funnel: landing → upload → reveal → saved (Admin overview).
    try {
      if (sessionStorage.getItem('cvs_lv')) return;
      sessionStorage.setItem('cvs_lv', '1');
    } catch {
      // Counted every time when storage is blocked; harmless.
    }
    void fetch('/api/metrics/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'landing_view' }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return (
    <DropZone
      id="landing-file"
      compact
      onFile={(f) => {
        handOff(f);
        router.push('/makeover');
      }}
    />
  );
}
