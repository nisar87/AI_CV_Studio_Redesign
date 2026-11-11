'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResumeDocument } from '@/modules/resume/schema';
import { getRepository } from '@/modules/storage/repository';
import { commit, initHistory, redo as redoH, undo as undoH, type History } from './history';

export type SaveState = 'saved' | 'saving' | 'error';

export type DocumentEditor = {
  doc: ResumeDocument;
  /** Apply an edit. `key` groups rapid typing in one field into a single undo step. */
  update: (fn: (d: ResumeDocument) => ResumeDocument, key?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: SaveState;
  flush: () => void;
};

const SAVE_DELAY = 400;

export function useDocumentEditor(initial: ResumeDocument): DocumentEditor {
  const [history, setHistory] = useState<History<ResumeDocument>>(() => initHistory(initial));
  const historyRef = useRef<History<ResumeDocument>>(history);
  const apply = useCallback((next: History<ResumeDocument>) => {
    historyRef.current = next;
    setHistory(next);
  }, []);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const pending = useRef<ResumeDocument | null>(null);
  const timer = useRef<number | null>(null);

  const persist = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const doc = pending.current;
    if (!doc) return;
    try {
      getRepository().save(doc);
      pending.current = null;
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  const schedule = useCallback(
    (doc: ResumeDocument) => {
      pending.current = doc;
      setSaveState('saving');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(persist, SAVE_DELAY);
    },
    [persist],
  );

  const update = useCallback(
    (fn: (d: ResumeDocument) => ResumeDocument, key?: string) => {
      const h = historyRef.current;
      const next = fn(h.present);
      if (next === h.present) return;
      const stamped = { ...next, updatedAt: new Date().toISOString() };
      apply(commit(h, stamped, key ?? null, Date.now()));
      schedule(stamped);
    },
    [apply, schedule],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    const n = undoH(h);
    if (n === h) return;
    apply(n);
    schedule(n.present);
  }, [apply, schedule]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    const n = redoH(h);
    if (n === h) return;
    apply(n);
    schedule(n.present);
  }, [apply, schedule]);

  // Keyboard shortcuts: Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Save immediately when the tab is hidden or closed; warn only if saving failed.
  useEffect(() => {
    const onHide = () => persist();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      persist();
      if (pending.current) e.preventDefault();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      persist();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [persist]);

  return {
    doc: history.present,
    update,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saveState,
    flush: persist,
  };
}
