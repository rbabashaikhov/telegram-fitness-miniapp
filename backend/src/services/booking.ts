import { AppError } from '../errors.js';
import type { Providers } from '../providers/types.js';
import type { BookingDetails, BookingStatus, TelegramUser } from '../types.js';
import { assertMembershipUsable, findUsableMembership, refreshMembershipCache } from './membership.js';

export function createBooking(
  providers: Providers,
  params: {
    user: TelegramUser;
    classSessionId: number;
    customerMembershipId?: number | null;
    now?: Date;
  },
): BookingDetails {
  const now = params.now ?? new Date();

  return providers.transaction(() => {
    const { customer, created } = providers.customers.upsert(params.user);
    if (created) {
      providers.events.publish('customer.created', { customerId: customer.id });
    }

    const session = providers.schedule.getSession(params.classSessionId);
    if (!session) {
      throw new AppError('Class session not found', 404, 'SESSION_NOT_FOUND');
    }
    if (session.status === 'CANCELLED') {
      throw new AppError('Cannot book a cancelled class', 400, 'SESSION_CANCELLED');
    }
    if (session.status === 'COMPLETED') {
      throw new AppError('Cannot book a completed class', 400, 'SESSION_COMPLETED');
    }
    if (new Date(session.starts_at).getTime() <= now.getTime()) {
      throw new AppError('Cannot book a class in the past', 400, 'SESSION_PAST');
    }

    const existing = providers.bookings.findActiveForSession(customer.id, session.id);
    if (existing) {
      throw new AppError('Already booked for this class', 409, 'ALREADY_BOOKED');
    }

    const activeCount = providers.schedule.countActiveBookings(session.id);
    if (activeCount >= session.capacity) {
      throw new AppError('Class is full', 409, 'CLASS_FULL');
    }

    const membership = params.customerMembershipId
      ? assertMembershipUsable(providers, {
          membershipId: params.customerMembershipId,
          customerId: customer.id,
          sessionStartsAt: session.starts_at,
        })
      : findUsableMembership(providers, customer.id, session.starts_at);

    const booking = providers.bookings.insert({
      customerId: customer.id,
      classSessionId: session.id,
      customerMembershipId: membership.membership.id,
    });

    providers.events.publish('booking.created', {
      bookingId: booking.id,
      customerId: customer.id,
      classSessionId: session.id,
      membershipId: membership.membership.id,
    });

    return booking;
  });
}

export function cancelBooking(
  providers: Providers,
  params: { bookingId: number; customerId?: number; now?: Date },
): BookingDetails {
  return providers.transaction(() => {
    const booking = providers.bookings.getById(params.bookingId);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (params.customerId && booking.customer_id !== params.customerId) {
      throw new AppError('Booking does not belong to this client', 403, 'BOOKING_FORBIDDEN');
    }
    if (booking.status === 'CANCELLED') {
      return booking;
    }
    if (booking.status === 'ATTENDED') {
      throw new AppError('Completed visits cannot be cancelled by the client', 400, 'BOOKING_ATTENDED');
    }

    const updated = providers.bookings.updateStatus(booking.id, 'CANCELLED', {
      cancelledAt: (params.now ?? new Date()).toISOString(),
    });
    providers.events.publish('booking.cancelled', {
      bookingId: booking.id,
      customerId: booking.customer_id,
    });
    return updated;
  });
}

export function setBookingStatus(
  providers: Providers,
  params: {
    bookingId: number;
    status: BookingStatus;
    now?: Date;
  },
): BookingDetails {
  const now = params.now ?? new Date();

  return providers.transaction(() => {
    const booking = providers.bookings.getById(params.bookingId);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    if (booking.status === params.status) {
      return booking;
    }

    const previous = booking.status;

    if (params.status === 'ATTENDED') {
      const updated = providers.bookings.updateStatus(booking.id, 'ATTENDED', {
        attendedAt: now.toISOString(),
      });
      redeemVisitIfNeeded(providers, updated);
      providers.events.publish('booking.attended', {
        bookingId: booking.id,
        customerId: booking.customer_id,
        membershipId: booking.customer_membership_id,
      });
      return providers.bookings.getById(booking.id)!;
    }

    if (previous === 'ATTENDED') {
      restoreVisitIfNeeded(providers, booking, `Reverted attendance to ${params.status}`);
    }

    const extra =
      params.status === 'CANCELLED'
        ? { cancelledAt: now.toISOString() }
        : params.status === 'NO_SHOW'
          ? { cancelledAt: now.toISOString() }
          : {};

    const updated = providers.bookings.updateStatus(booking.id, params.status, extra);
    if (params.status === 'NO_SHOW') {
      providers.events.publish('booking.no_show', {
        bookingId: booking.id,
        customerId: booking.customer_id,
      });
    } else {
      providers.events.publish('booking.status_changed', {
        bookingId: booking.id,
        status: params.status,
      });
    }
    return updated;
  });
}

function redeemVisitIfNeeded(providers: Providers, booking: BookingDetails): void {
  if (!booking.customer_membership_id) return;
  const existing = providers.memberships.findRedeemForBooking(booking.id);
  if (existing) return;
  const membership = providers.memberships.getCustomerMembership(booking.customer_membership_id);
  if (!membership) return;
  const plan = providers.memberships.getPlan(membership.membership_plan_id);
  if (!plan || plan.membership_type !== 'VISIT_BASED') return;

  providers.memberships.insertLedger({
    customerMembershipId: membership.id,
    bookingId: booking.id,
    operation: 'REDEEM',
    delta: -1,
    reason: `Attended ${booking.session.activity_name}`,
  });
  refreshMembershipCache(providers, membership.id);
}

function restoreVisitIfNeeded(providers: Providers, booking: BookingDetails, reason: string): void {
  if (!booking.customer_membership_id) return;
  const redeem = providers.memberships.findRedeemForBooking(booking.id);
  if (!redeem) return;
  providers.memberships.insertLedger({
    customerMembershipId: booking.customer_membership_id,
    bookingId: booking.id,
    operation: 'RESTORE',
    delta: 1,
    reason,
  });
  refreshMembershipCache(providers, booking.customer_membership_id);
}
