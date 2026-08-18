import { describe, expect, it } from 'vitest';
import { createTourStorage, type StorageAdapter } from './storage';

function memoryAdapter(initial: Record<string, string> = {}): StorageAdapter {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe('tour storage', () => {
  it('treats a missing key as unseen', () => {
    expect(createTourStorage('demo.tour', memoryAdapter()).hasBeenSeen()).toBe(false);
  });

  it('persists skip and complete', () => {
    const storage = createTourStorage('demo.tour', memoryAdapter());
    storage.markSeen('skipped');
    expect(storage.readReason()).toBe('skipped');
  });
});
