export type TourSeenReason = 'skipped' | 'completed';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memory = new Map<string, string>();

export const memoryStorage: StorageAdapter = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

export function browserStorage(): StorageAdapter {
  try {
    if (typeof localStorage === 'undefined') return memoryStorage;
    const probe = '__demo_tour_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return memoryStorage;
  }
}

export interface TourStorage {
  hasBeenSeen(): boolean;
  markSeen(reason: TourSeenReason): void;
  clear(): void;
  readReason(): TourSeenReason | null;
}

export function createTourStorage(key: string, adapter: StorageAdapter = browserStorage()): TourStorage {
  return {
    hasBeenSeen() {
      return this.readReason() !== null;
    },
    markSeen(reason) {
      adapter.setItem(key, JSON.stringify({ status: reason, at: new Date().toISOString() }));
    },
    clear() {
      adapter.removeItem(key);
    },
    readReason() {
      const raw = adapter.getItem(key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { status?: string };
        if (parsed.status === 'skipped' || parsed.status === 'completed') return parsed.status;
      } catch {
        if (raw === 'skipped' || raw === 'completed') return raw;
      }
      return null;
    },
  };
}
