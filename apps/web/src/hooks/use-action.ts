'use client';

import { useCallback, useState } from 'react';

/** Runs a write action and keeps its failure for display, instead of letting a rejected promise vanish silently. */
export function useAction() {
  const [error, setError] = useState('');
  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    setError('');
    try { await fn(); return true; } catch (e: any) { setError(e?.message || 'Something went wrong. Please try again.'); return false; }
  }, []);
  return { error, run, clear: () => setError('') };
}
