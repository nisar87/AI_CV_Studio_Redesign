'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Entitlements } from '@/modules/billing/server';
import { useAccount } from './account-context';

/** The server's view of what this person may do (display only; the server enforces). */
export function useEntitlements() {
  const account = useAccount();
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const key = `${account.status}:${account.user?.uid ?? ''}`;
  useEffect(() => {
    if (key.startsWith('loading')) return;
    let live = true;
    fetch('/api/me/entitlements', { cache: 'no-store' })
      .then((r) => r.json() as Promise<Entitlements>)
      .then((e) => live && setEnt(e))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, tick]);
  return { ent, refresh };
}

export function isPremiumDesign(ent: Entitlements | null, id: string) {
  return ent?.designs.find((d) => d.id === id)?.tier === 'premium';
}

export function remaining(ent: Entitlements, cap: keyof Entitlements['limits']) {
  const l = ent.limits[cap];
  return l === -1 ? Infinity : Math.max(0, l - ent.usage[cap]);
}
