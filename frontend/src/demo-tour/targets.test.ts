import { describe, expect, it } from 'vitest';
import { findTourTarget, tourTargetSelector, waitForTourTarget } from './targets';

function fakeRoot(hook: string | null): ParentNode {
  return {
    querySelector(selector: string) {
      if (hook && selector === tourTargetSelector(hook)) {
        return { id: hook } as unknown as Element;
      }
      return null;
    },
  } as ParentNode;
}

describe('tour targets', () => {
  it('uses stable data-demo-tour hooks', () => {
    expect(tourTargetSelector('client-membership')).toBe('[data-demo-tour="client-membership"]');
  });

  it('returns null when missing', async () => {
    expect(findTourTarget('missing', fakeRoot(null))).toBeNull();
    await expect(
      waitForTourTarget('missing', { root: fakeRoot(null), timeoutMs: 40, intervalMs: 10 }),
    ).resolves.toBeNull();
  });
});
