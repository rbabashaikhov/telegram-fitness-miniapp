import { describe, expect, it } from 'vitest';
import { createBooking } from './booking.js';
import { purchaseMembership } from './membership.js';
import { createExternalPaymentProvider } from '../providers/payments/external.js';
import { createFutureSession, createTestWorld, seedDemoDb } from '../test/harness.js';

const user = { id: 1001, first_name: 'Александр', last_name: 'Тестов' };

describe('membership purchase', () => {
  it('charges mock payment and issues a persisted membership', () => {
    const world = createTestWorld();
    const result = purchaseMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planVisitId,
    });

    expect(result.payment.status).toBe('mock');
    expect(result.membership.membership.status).toBe('ACTIVE');
    expect(result.membership.remaining).toBe(12);
    expect(result.membership.plan.name).toBe('12 Visits');

    const stored = world.providers.memberships.getCustomerMembership(result.membership.membership.id);
    expect(stored?.customer_id).toBe(world.customer.id);
    expect(stored?.remaining_visits).toBe(12);
    const ledger = world.providers.memberships.listLedger(result.membership.membership.id);
    expect(ledger.some((entry) => entry.operation === 'PURCHASE' && entry.delta === 12)).toBe(true);
  });

  it('renewal issues a second membership without replacing the first', () => {
    const world = createTestWorld();
    const first = purchaseMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planVisitId,
    });
    const second = purchaseMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planUnlimitedId,
    });

    const memberships = world.providers.memberships.listCustomerMemberships(world.customer.id);
    expect(memberships).toHaveLength(2);
    expect(first.membership.membership.id).not.toBe(second.membership.membership.id);
    expect(memberships.map((item) => item.id)).toEqual(
      expect.arrayContaining([first.membership.membership.id, second.membership.membership.id]),
    );
    expect(second.membership.plan.membership_type).toBe('UNLIMITED');
    expect(second.membership.remaining).toBeNull();
  });

  it('does not issue a membership when the payment adapter is not configured', () => {
    const world = createTestWorld();
    const providers = { ...world.providers, payments: createExternalPaymentProvider() };
    expect(() =>
      purchaseMembership(providers, { customerId: world.customer.id, planId: world.planVisitId }),
    ).toThrow(/PAYMENT_NOT_CONFIGURED|not configured/i);
    expect(providers.memberships.listCustomerMemberships(world.customer.id)).toHaveLength(0);
  });

  it('rejects an inactive plan', () => {
    const world = createTestWorld();
    world.providers.memberships.updatePlan(world.planVisitId, { active: false });
    expect(() =>
      purchaseMembership(world.providers, { customerId: world.customer.id, planId: world.planVisitId }),
    ).toThrow(/PLAN_NOT_FOUND|not found/i);
  });

  it('booking still requires a usable membership after catalog exists', () => {
    const world = createTestWorld();
    const session = createFutureSession(world);
    expect(() => createBooking(world.providers, { user, classSessionId: session.id, now: world.now })).toThrow(
      /membership/i,
    );

    purchaseMembership(world.providers, { customerId: world.customer.id, planId: world.planVisitId });
    const booking = createBooking(world.providers, { user, classSessionId: session.id, now: world.now });
    expect(booking.status).toBe('BOOKED');
  });
});

describe('membership catalog seed', () => {
  it('exposes a natural client catalog of active plans', () => {
    const { providers } = seedDemoDb();
    const names = providers.memberships.listPlans(true).map((plan) => plan.name);
    expect(names).toEqual(
      expect.arrayContaining(['Разовое посещение', '8 посещений', '12 посещений', 'Безлимит на месяц']),
    );
    const dropIn = providers.memberships.listPlans(true).find((plan) => plan.name === 'Разовое посещение');
    expect(dropIn?.visit_limit).toBe(1);
    const eight = providers.memberships.listPlans(true).find((plan) => plan.name === '8 посещений');
    expect(eight?.visit_limit).toBe(8);
  });
});
