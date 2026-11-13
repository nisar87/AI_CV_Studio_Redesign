'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AiResponse, TaskId, TaskInput } from '@/modules/ai/schemas';

/** Browser side of AI help: availability, the per-device on/off setting and API calls. */

export type AiStatus = { enabled: boolean; provider: 'gemini' | 'mock' | 'off' };

let statusPromise: Promise<AiStatus> | null = null;
function loadStatus(): Promise<AiStatus> {
  statusPromise ??= fetch('/api/ai/status', { cache: 'no-store' })
    .then((r) =>
      r.ok ? (r.json() as Promise<AiStatus>) : { enabled: false, provider: 'off' as const },
    )
    .catch(() => ({ enabled: false, provider: 'off' as const }));
  return statusPromise;
}

const PREF_KEY = 'cvstudio.ai';
const listeners = new Set<() => void>();
function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setAiPreference(on: boolean) {
  try {
    if (on) localStorage.removeItem(PREF_KEY);
    else localStorage.setItem(PREF_KEY, 'off');
  } catch {
    /* storage blocked: setting lasts for this page only */
  }
  listeners.forEach((l) => l());
}

/** Whether AI actions should be shown, and whether answers are real or demo. */
export function useAi() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let live = true;
    loadStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  const userOn = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readPref,
    () => true,
  );
  return {
    available: Boolean(status?.enabled),
    demo: status?.provider === 'mock',
    userOn,
    show: Boolean(status?.enabled) && userOn,
  };
}

export function deviceId(): string {
  try {
    let id = localStorage.getItem('cvstudio.device');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('cvstudio.device', id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

export type AiCallResult<T extends TaskId> =
  { ok: true; data: AiResponse<T> } | { ok: false; message: string; code: string };

const CLIENT_TIMEOUT_MS = 45_000;

export async function callAi<T extends TaskId>(
  task: T,
  input: TaskInput<T>,
  attempt = 0,
  signal?: AbortSignal,
): Promise<AiCallResult<T>> {
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const res = await fetch(`/api/ai/${task}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-id': deviceId() },
      body: JSON.stringify({ input, attempt }),
      signal: combined,
    });
    const json = (await res.json().catch(() => null)) as
      AiResponse<T> | { error?: { code?: string; message?: string } } | null;
    if (res.ok && json && 'result' in json) return { ok: true, data: json };
    const err = json && 'error' in json ? json.error : undefined;
    return {
      ok: false,
      code: err?.code ?? 'AI_UNAVAILABLE',
      message: err?.message ?? 'AI help is not available right now. You can keep writing yourself.',
    };
  } catch (e) {
    if (signal?.aborted) return { ok: false, code: 'ABORTED', message: '' };
    return {
      ok: false,
      code: 'AI_UNAVAILABLE',
      message:
        (e as Error).name === 'TimeoutError'
          ? 'AI help is taking too long right now. Please try again, or keep writing yourself.'
          : 'We couldn’t reach AI help. Check your connection, or keep writing yourself.',
    };
  }
}
