import { describe, expect, it } from 'vitest';
import { membershipHomeState } from './membershipCta';

const base = {
  status: 'ACTIVE',
  membershipType: 'VISIT_BASED' as const,
  remainingVisits: 5,
  totalVisits: 8,
  expiresAt: '2026-09-20',
  planId: 3,
};

const options = { today: '2026-08-20', expiringDays: 7, lowVisits: 2 };

describe('membershipHomeState', () => {
  it('sends a new client to the catalog', () => {
    const state = membershipHomeState(null, options);
    expect(state.urgency).toBe('missing');
    expect(state.primary).toEqual({ label: 'Выбрать абонемент', to: '/plans' });
    expect(state.secondary).toBeNull();
  });

  it('uses Продлить when remaining visits are low', () => {
    const state = membershipHomeState({ ...base, remainingVisits: 2 }, options);
    expect(state.urgency).toBe('low-balance');
    expect(state.remainingLine).toBe('Осталось 2 из 8');
    expect(state.expiresLine).toBe('До 20 сентября');
    expect(state.primary.label).toBe('Продлить');
    expect(state.primary.to).toBe('/plans/3');
    expect(state.secondary?.label).toBe('Выбрать новый тариф');
  });

  it('flags a membership expiring within retention.expiringDays', () => {
    const state = membershipHomeState({ ...base, expiresAt: '2026-08-24' }, options);
    expect(state.urgency).toBe('expiring');
    expect(state.primary.label).toBe('Продлить');
  });

  it('treats expired and exhausted cards as renewal', () => {
    expect(membershipHomeState({ ...base, status: 'EXPIRED', expiresAt: '2026-08-01' }, options).urgency).toBe(
      'expired',
    );
    expect(membershipHomeState({ ...base, status: 'EXHAUSTED', remainingVisits: 0 }, options).urgency).toBe(
      'exhausted',
    );
    expect(membershipHomeState({ ...base, remainingVisits: 0 }, options).urgency).toBe('exhausted');
  });

  it('keeps both CTAs for a healthy membership', () => {
    const state = membershipHomeState(base, options);
    expect(state.urgency).toBe('ok');
    expect(state.eyebrow).toBe('Ваш абонемент');
    expect(state.primary.label).toBe('Продлить');
    expect(state.secondary?.label).toBe('Выбрать новый тариф');
  });
});
