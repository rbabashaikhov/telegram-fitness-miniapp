import { describe, expect, it } from 'vitest';
import { listRetentionSignals } from './retention.js';
import { seedDemoDb } from '../test/harness.js';

describe('retention signals', () => {
  it('detects expiring, low visits, inactive, cancellations and no-show cases', () => {
    const { providers } = seedDemoDb();
    const signals = listRetentionSignals(providers, new Date('2026-08-18T09:00:00+03:00'));
    const kinds = new Set(signals.map((item) => item.kind));
    expect(kinds.has('expiring')).toBe(true);
    expect(kinds.has('low_visits')).toBe(true);
    expect(kinds.has('inactive')).toBe(true);
    expect(kinds.has('cancellations')).toBe(true);
    expect(kinds.has('no_show')).toBe(true);
    expect(signals.some((item) => item.customerName.includes('Соколова'))).toBe(true);
    expect(signals.some((item) => item.customerName.includes('Иванов'))).toBe(true);
    expect(signals.some((item) => item.customerName.includes('Петров'))).toBe(true);
  });
});
