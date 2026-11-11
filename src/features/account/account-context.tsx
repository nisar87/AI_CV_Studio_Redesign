'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getRepository } from '@/modules/storage/repository';
import { signOutEverywhere } from './firebase-client';
import { CloudSync, type SyncState } from './sync';

export type AccountUser = {
  uid: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  picture: string | null;
  admin: boolean;
};

type AccountValue = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AccountUser | null;
  sync: SyncState;
  /** True once the first account↔device merge after sign-in has finished. */
  synced: boolean;
  refresh: () => Promise<void>;
  signOut: (everywhere?: boolean) => Promise<void>;
};

const Ctx = createContext<AccountValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [status, setStatus] = useState<AccountValue['status']>('loading');
  const [sync, setSync] = useState<SyncState>('idle');
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  const engine = useRef<CloudSync | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/me', { cache: 'no-store' });
      const j = (await r.json()) as { user: AccountUser | null };
      setUser(j.user);
      setStatus(j.user ? 'signedIn' : 'signedOut');
    } catch {
      setStatus((s) => (s === 'loading' ? 'signedOut' : s));
    }
  }, []);

  useEffect(() => {
    let live = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ user: AccountUser | null }>)
      .then((j) => {
        if (!live) return;
        setUser(j.user);
        setStatus(j.user ? 'signedIn' : 'signedOut');
      })
      .catch(() => live && setStatus('signedOut'));
    return () => {
      live = false;
    };
  }, []);

  // Start or stop cloud sync when the signed-in user changes.
  const uid = user?.uid ?? null;
  useEffect(() => {
    if (!uid) return;
    const s = new CloudSync(uid, getRepository());
    engine.current = s;
    const off = s.onState(setSync);
    void s.start().finally(() => setSyncedFor(uid));
    const onOnline = () => void s.fullSync();
    const onVisible = () => document.visibilityState === 'visible' && void s.fullSync();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      s.stop();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      if (engine.current === s) engine.current = null;
    };
  }, [uid]);

  const signOut = useCallback(async (everywhere = false) => {
    await engine.current?.signOutCleanup();
    engine.current = null;
    await signOutEverywhere(everywhere);
    setUser(null);
    setStatus('signedOut');
    setSync('idle');
  }, []);

  const synced = uid !== null && syncedFor === uid;
  const value = useMemo(
    () => ({ status, user, sync, synced, refresh, signOut }),
    [status, user, sync, synced, refresh, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): AccountValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount must be used inside <AccountProvider>');
  return v;
}

/** Re-render when this device's documents change (e.g. after a sync pulls new CVs). */
export function useRepositoryVersion(): number {
  const [n, setN] = useState(0);
  useEffect(() => getRepository().subscribe(() => setN((x) => x + 1)), []);
  return n;
}
