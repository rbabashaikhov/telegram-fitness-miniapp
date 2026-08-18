import { describe, expect, it } from 'vitest';
import { createBooking, setBookingStatus } from './booking.js';
import { calculateMembershipBalance, issueMembership } from './membership.js';
import { createFutureSession, createTestWorld } from '../test/harness.js';

const user = { id: 1001, first_name: 'Александр', last_name: 'Тестов' };

describe('booking invariants', () => {
  it('rejects a second booking for the same class', async () => {
    const world = createTestWorld();
    issueMembership(world.providers, { customerId: world.customer.id, planId: world.planVisitId, startsAt: world.today });
    const session = createFutureSession(world);
    createBooking(world.providers, { user, classSessionId: session.id, now: world.now });
    expect(() => createBooking(world.providers, { user, classSessionId: session.id, now: world.now })).toThrow(
      /Already booked/,
    );
  });

  it('rejects booking a cancelled session', () => {
    const world = createTestWorld();
    issueMembership(world.providers, { customerId: world.customer.id, planId: world.planVisitId, startsAt: world.today });
    const session = createFutureSession(world, { status: 'CANCELLED' });
    expect(() => createBooking(world.providers, { user, classSessionId: session.id, now: world.now })).toThrow(
      /cancelled/i,
    );
  });

  it('rejects booking a full class', () => {
    const world = createTestWorld();
    const session = createFutureSession(world, { capacity: 1 });
    const other = world.providers.customers.upsert({ id: 2002, first_name: 'Мария' }).customer;
    issueMembership(world.providers, { customerId: other.id, planId: world.planVisitId, startsAt: world.today });
    issueMembership(world.providers, { customerId: world.customer.id, planId: world.planVisitId, startsAt: world.today });
    createBooking(world.providers, {
      user: { id: 2002, first_name: 'Мария' },
      classSessionId: session.id,
      now: world.now,
    });
    expect(() => createBooking(world.providers, { user, classSessionId: session.id, now: world.now })).toThrow(
      /full/i,
    );
  });

  it('rejects booking a class in the past', () => {
    const world = createTestWorld();
    issueMembership(world.providers, { customerId: world.customer.id, planId: world.planVisitId, startsAt: world.today });
    const session = createFutureSession(world, { date: '2026-08-01' });
    expect(() => createBooking(world.providers, { user, classSessionId: session.id, now: world.now })).toThrow(
      /past/i,
    );
  });

  it('rejects booking without an active membership', () => {
    const world = createTestWorld();
    const session = createFutureSession(world);
    expect(() => createBooking(world.providers, { user, classSessionId: session.id, now: world.now })).toThrow(
      /membership/i,
    );
  });
});

describe('membership ledger', () => {
  it('does not decrease visits when a class is booked', () => {
    const world = createTestWorld();
    const issued = issueMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planVisitId,
      startsAt: world.today,
    });
    const session = createFutureSession(world);
    createBooking(world.providers, { user, classSessionId: session.id, now: world.now });
    const balance = calculateMembershipBalance(world.providers, issued.membership.id);
    expect(balance.remaining).toBe(12);
    expect(balance.used).toBe(0);
    expect(balance.reserved).toBe(1);
  });

  it('decreases visits once when marked ATTENDED', () => {
    const world = createTestWorld();
    const issued = issueMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planVisitId,
      startsAt: world.today,
    });
    const session = createFutureSession(world);
    const booking = createBooking(world.providers, { user, classSessionId: session.id, now: world.now });
    setBookingStatus(world.providers, { bookingId: booking.id, status: 'ATTENDED', now: world.now });
    const balance = calculateMembershipBalance(world.providers, issued.membership.id);
    expect(balance.remaining).toBe(11);
    expect(balance.used).toBe(1);
  });

  it('does not redeem twice for the same ATTENDED booking', () => {
    const world = createTestWorld();
    const issued = issueMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planVisitId,
      startsAt: world.today,
    });
    const session = createFutureSession(world);
    const booking = createBooking(world.providers, { user, classSessionId: session.id, now: world.now });
    setBookingStatus(world.providers, { bookingId: booking.id, status: 'ATTENDED', now: world.now });
    setBookingStatus(world.providers, { bookingId: booking.id, status: 'ATTENDED', now: world.now });
    const balance = calculateMembershipBalance(world.providers, issued.membership.id);
    expect(balance.remaining).toBe(11);
    expect(world.providers.memberships.listLedger(issued.membership.id).filter((item) => item.operation === 'REDEEM')).toHaveLength(1);
  });

  it('does not redeem on cancel', () => {
    const world = createTestWorld();
    const issued = issueMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planVisitId,
      startsAt: world.today,
    });
    const session = createFutureSession(world);
    const booking = createBooking(world.providers, { user, classSessionId: session.id, now: world.now });
    setBookingStatus(world.providers, { bookingId: booking.id, status: 'CANCELLED', now: world.now });
    const balance = calculateMembershipBalance(world.providers, issued.membership.id);
    expect(balance.remaining).toBe(12);
    expect(balance.used).toBe(0);
  });

  it('restores a visit when ATTENDED is reverted', () => {
    const world = createTestWorld();
    const issued = issueMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planVisitId,
      startsAt: world.today,
    });
    const session = createFutureSession(world);
    const booking = createBooking(world.providers, { user, classSessionId: session.id, now: world.now });
    setBookingStatus(world.providers, { bookingId: booking.id, status: 'ATTENDED', now: world.now });
    setBookingStatus(world.providers, { bookingId: booking.id, status: 'BOOKED', now: world.now });
    const balance = calculateMembershipBalance(world.providers, issued.membership.id);
    expect(balance.remaining).toBe(12);
    expect(balance.used).toBe(0);
  });

  it('rejects expired, exhausted and frozen memberships', () => {
    const world = createTestWorld();
    const expired = issueMembership(world.providers, {
      customerId: world.customer.id,
      planId: world.planVisitId,
      startsAt: '2026-01-01',
    });
    world.providers.memberships.updateCustomerMembership(expired.membership.id, {
      expires_at: '2026-02-01',
      status: 'EXPIRED',
    });
    const session = createFutureSession(world);
    expect(() =>
      createBooking(world.providers, {
        user,
        classSessionId: session.id,
        customerMembershipId: expired.membership.id,
        now: world.now,
      }),
    ).toThrow(/expired/i);

    const otherUser = { id: 3003, first_name: 'Иван' };
    const other = world.providers.customers.upsert(otherUser).customer;
    const exhausted = issueMembership(world.providers, {
      customerId: other.id,
      planId: world.planVisitId,
      startsAt: world.today,
    });
    world.providers.memberships.insertLedger({
      customerMembershipId: exhausted.membership.id,
      operation: 'ADJUSTMENT',
      delta: -12,
      reason: 'used up',
    });
    world.providers.memberships.updateCustomerMembership(exhausted.membership.id, {
      remaining_visits: 0,
      status: 'EXHAUSTED',
    });
    expect(() =>
      createBooking(world.providers, {
        user: otherUser,
        classSessionId: session.id,
        customerMembershipId: exhausted.membership.id,
        now: world.now,
      }),
    ).toThrow(/visits remaining|EXHAUSTED|exhausted/i);

    const frozenUser = { id: 4004, first_name: 'Ольга' };
    const frozenCustomer = world.providers.customers.upsert(frozenUser).customer;
    const frozen = issueMembership(world.providers, {
      customerId: frozenCustomer.id,
      planId: world.planVisitId,
      startsAt: world.today,
    });
    world.providers.memberships.updateCustomerMembership(frozen.membership.id, { status: 'FROZEN' });
    expect(() =>
      createBooking(world.providers, {
        user: frozenUser,
        classSessionId: session.id,
        customerMembershipId: frozen.membership.id,
        now: world.now,
      }),
    ).toThrow(/frozen/i);
  });
});

describe('capacity under concurrent requests', () => {
  it('does not exceed class capacity', () => {
    const world = createTestWorld();
    const session = createFutureSession(world, { capacity: 1 });
    const first = world.providers.customers.upsert({ id: 5001, first_name: 'А' }).customer;
    const second = world.providers.customers.upsert({ id: 5002, first_name: 'Б' }).customer;
    issueMembership(world.providers, { customerId: first.id, planId: world.planVisitId, startsAt: world.today });
    issueMembership(world.providers, { customerId: second.id, planId: world.planVisitId, startsAt: world.today });

    const results: Array<'ok' | 'fail'> = [];
    world.providers.transaction(() => {
      try {
        createBooking(world.providers, {
          user: { id: 5001, first_name: 'А' },
          classSessionId: session.id,
          now: world.now,
        });
        results.push('ok');
      } catch {
        results.push('fail');
      }
      try {
        createBooking(world.providers, {
          user: { id: 5002, first_name: 'Б' },
          classSessionId: session.id,
          now: world.now,
        });
        results.push('ok');
      } catch {
        results.push('fail');
      }
    });

    expect(results.filter((item) => item === 'ok')).toHaveLength(1);
    expect(world.providers.schedule.countActiveBookings(session.id)).toBe(1);
  });
});
