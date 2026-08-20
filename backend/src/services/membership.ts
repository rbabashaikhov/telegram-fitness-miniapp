import { AppError } from '../errors.js';
import type { Providers } from '../providers/types.js';
import type { CustomerMembership, MembershipBalance, MembershipStatus } from '../types.js';
import { daysBetween, todayDateString } from './time.js';

export function ledgerNetVisits(
  entries: Array<{ operation: string; delta: number }>,
): number {
  return entries.reduce((sum, entry) => sum + entry.delta, 0);
}

export function calculateMembershipBalance(
  providers: Providers,
  membershipId: number,
): MembershipBalance {
  const membership = providers.memberships.getCustomerMembership(membershipId);
  if (!membership) {
    throw new AppError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  }
  const plan = providers.memberships.getPlan(membership.membership_plan_id);
  if (!plan) {
    throw new AppError('Membership plan not found', 404, 'PLAN_NOT_FOUND');
  }
  const ledger = providers.memberships.listLedger(membershipId);
  const remainingFromLedger = plan.membership_type === 'UNLIMITED' ? null : ledgerNetVisits(ledger);
  const reserved = providers.bookings
    .list({ customerId: membership.customer_id, status: 'BOOKED' })
    .filter((booking) => booking.customer_membership_id === membershipId).length;
  const redeemed = ledger
    .filter((entry) => entry.operation === 'REDEEM')
    .reduce((sum, entry) => sum + Math.abs(entry.delta), 0);
  const restored = ledger
    .filter((entry) => entry.operation === 'RESTORE')
    .reduce((sum, entry) => sum + entry.delta, 0);
  const used = Math.max(0, redeemed - restored);
  const remaining = remainingFromLedger;
  const bookable =
    remaining === null ? null : Math.max(0, remaining - reserved);

  return {
    membership,
    plan,
    redeemed: used,
    remaining,
    reserved,
    bookable,
    used,
  };
}

export function refreshMembershipCache(providers: Providers, membershipId: number): CustomerMembership {
  const balance = calculateMembershipBalance(providers, membershipId);
  const membership = balance.membership;
  let status: MembershipStatus = membership.status;
  const today = todayDateString();

  if (status !== 'CANCELLED' && status !== 'FROZEN') {
    if (membership.expires_at < today) {
      status = 'EXPIRED';
    } else if (balance.plan.membership_type === 'VISIT_BASED' && (balance.remaining ?? 0) <= 0) {
      status = 'EXHAUSTED';
    } else {
      status = 'ACTIVE';
    }
  }

  return providers.memberships.updateCustomerMembership(membershipId, {
    remaining_visits: balance.remaining,
    status,
  });
}

export function assertMembershipUsable(
  providers: Providers,
  params: {
    membershipId: number;
    customerId: number;
    sessionStartsAt: string;
  },
): MembershipBalance {
  const balance = calculateMembershipBalance(providers, params.membershipId);
  const { membership, plan } = balance;

  if (membership.customer_id !== params.customerId) {
    throw new AppError('Membership does not belong to this client', 403, 'MEMBERSHIP_FORBIDDEN');
  }
  if (membership.status === 'CANCELLED') {
    throw new AppError('Membership is cancelled', 400, 'MEMBERSHIP_CANCELLED');
  }
  if (membership.status === 'FROZEN') {
    throw new AppError('Membership is frozen', 400, 'MEMBERSHIP_FROZEN');
  }

  const sessionDate = params.sessionStartsAt.slice(0, 10);
  if (membership.expires_at < sessionDate || membership.status === 'EXPIRED') {
    throw new AppError('Membership has expired', 400, 'MEMBERSHIP_EXPIRED');
  }
  if (membership.starts_at > sessionDate) {
    throw new AppError('Membership is not active yet', 400, 'MEMBERSHIP_NOT_STARTED');
  }
  if (plan.membership_type === 'VISIT_BASED') {
    if (membership.status === 'EXHAUSTED' || (balance.bookable ?? 0) <= 0) {
      throw new AppError('No visits remaining on this membership', 400, 'MEMBERSHIP_EXHAUSTED');
    }
  }
  return balance;
}

export function findUsableMembership(
  providers: Providers,
  customerId: number,
  sessionStartsAt: string,
): MembershipBalance {
  const memberships = providers.memberships.listCustomerMemberships(customerId);
  const usable: MembershipBalance[] = [];
  for (const membership of memberships) {
    try {
      usable.push(
        assertMembershipUsable(providers, {
          membershipId: membership.id,
          customerId,
          sessionStartsAt,
        }),
      );
    } catch {
      // skip unusable
    }
  }
  if (!usable.length) {
    throw new AppError('No active membership available for this class', 400, 'MEMBERSHIP_REQUIRED');
  }
  usable.sort((a, b) => {
    const aDays = daysBetween(todayDateString(), a.membership.expires_at);
    const bDays = daysBetween(todayDateString(), b.membership.expires_at);
    if (a.plan.membership_type !== b.plan.membership_type) {
      return a.plan.membership_type === 'VISIT_BASED' ? -1 : 1;
    }
    return aDays - bDays;
  });
  return usable[0];
}

export function issueMembership(
  providers: Providers,
  params: {
    customerId: number;
    planId: number;
    startsAt?: string;
  },
): MembershipBalance {
  const customer = providers.customers.getById(params.customerId);
  if (!customer) throw new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  const plan = providers.memberships.getPlan(params.planId);
  if (!plan) throw new AppError('Membership plan not found', 404, 'PLAN_NOT_FOUND');

  const startsAt = params.startsAt ?? todayDateString();
  const expiresAt = addDaysInclusive(startsAt, plan.duration_days);
  const total = plan.membership_type === 'VISIT_BASED' ? plan.visit_limit : null;

  const membership = providers.transaction(() => {
    const created = providers.memberships.createCustomerMembership({
      customer_id: params.customerId,
      membership_plan_id: plan.id,
      starts_at: startsAt,
      expires_at: expiresAt,
      total_visits: total,
      remaining_visits: total,
      status: 'ACTIVE',
      freeze_from: null,
      freeze_until: null,
    });
    providers.memberships.insertLedger({
      customerMembershipId: created.id,
      operation: 'PURCHASE',
      delta: total ?? 0,
      reason: `Issued ${plan.name}`,
    });
    return created;
  });

  providers.events.publish('membership.issued', {
    customerId: params.customerId,
    membershipId: membership.id,
    planId: plan.id,
  });

  return calculateMembershipBalance(providers, membership.id);
}

export function purchaseMembership(
  providers: Providers,
  params: {
    customerId: number;
    planId: number;
  },
): { membership: MembershipBalance; payment: { id: string; status: 'mock' } } {
  const plan = providers.memberships.getPlan(params.planId);
  if (!plan || !plan.active) {
    throw new AppError('Membership plan not found', 404, 'PLAN_NOT_FOUND');
  }

  const payment = providers.payments.createIntent({
    customerId: params.customerId,
    planId: plan.id,
    amount: plan.price ?? 0,
  });

  const membership = issueMembership(providers, {
    customerId: params.customerId,
    planId: plan.id,
  });

  return { membership, payment };
}

function addDaysInclusive(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function adjustMembershipVisits(
  providers: Providers,
  membershipId: number,
  delta: number,
  reason: string,
): MembershipBalance {
  const membership = providers.memberships.getCustomerMembership(membershipId);
  if (!membership) throw new AppError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  const plan = providers.memberships.getPlan(membership.membership_plan_id);
  if (plan?.membership_type !== 'VISIT_BASED') {
    throw new AppError('Visit adjustment is only available for visit-based memberships', 400, 'NOT_VISIT_BASED');
  }
  providers.transaction(() => {
    providers.memberships.insertLedger({
      customerMembershipId: membershipId,
      operation: 'ADJUSTMENT',
      delta,
      reason,
    });
    refreshMembershipCache(providers, membershipId);
  });
  providers.events.publish('membership.adjusted', { membershipId, delta, reason });
  return calculateMembershipBalance(providers, membershipId);
}

export function freezeMembership(
  providers: Providers,
  membershipId: number,
  freezeUntil: string,
): CustomerMembership {
  const membership = providers.memberships.getCustomerMembership(membershipId);
  if (!membership) throw new AppError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  const updated = providers.memberships.updateCustomerMembership(membershipId, {
    status: 'FROZEN',
    freeze_from: todayDateString(),
    freeze_until: freezeUntil,
  });
  providers.events.publish('membership.frozen', { membershipId, freezeUntil });
  return updated;
}

export function unfreezeMembership(providers: Providers, membershipId: number): CustomerMembership {
  const membership = providers.memberships.getCustomerMembership(membershipId);
  if (!membership) throw new AppError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  const updated = providers.memberships.updateCustomerMembership(membershipId, {
    status: 'ACTIVE',
    freeze_from: null,
    freeze_until: null,
  });
  return refreshMembershipCache(providers, updated.id);
}

export function cancelMembership(providers: Providers, membershipId: number): CustomerMembership {
  const membership = providers.memberships.getCustomerMembership(membershipId);
  if (!membership) throw new AppError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  const updated = providers.memberships.updateCustomerMembership(membershipId, {
    status: 'CANCELLED',
  });
  providers.events.publish('membership.cancelled', { membershipId });
  return updated;
}

export function extendMembership(
  providers: Providers,
  membershipId: number,
  expiresAt: string,
): CustomerMembership {
  const membership = providers.memberships.getCustomerMembership(membershipId);
  if (!membership) throw new AppError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  providers.memberships.updateCustomerMembership(membershipId, { expires_at: expiresAt });
  return refreshMembershipCache(providers, membershipId);
}
