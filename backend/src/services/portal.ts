import type { Providers } from '../providers/types.js';
import type { AdminDashboard, BookingDetails, ClassSessionDetails, MembershipBalance } from '../types.js';
import { calculateMembershipBalance } from './membership.js';
import { getCustomerProgress } from './progress.js';
import { addDaysIso, todayDateString } from './time.js';

export function getAdminDashboard(providers: Providers, now = new Date()): AdminDashboard {
  const today = todayDateString(now);
  const tomorrow = addDaysIso(today, 1);
  const monthStart = `${today.slice(0, 7)}-01`;
  const customers = providers.customers.listAll().filter((customer) => customer.status === 'ACTIVE');
  const memberships = providers.memberships
    .listCustomerMemberships()
    .filter((item) => item.status === 'ACTIVE');
  const todaySessions = providers.schedule.listSessions({
    from: `${today}T00:00:00.000Z`,
    to: `${tomorrow}T00:00:00.000Z`,
    status: 'SCHEDULED',
  });
  const todayBookings = providers.bookings.list({
    from: `${today}T00:00:00.000Z`,
    to: `${tomorrow}T00:00:00.000Z`,
  });
  const monthAttendance = providers.bookings.list({
    status: 'ATTENDED',
    from: `${monthStart}T00:00:00.000Z`,
  });

  const capacity = todaySessions.reduce((sum, session) => sum + session.capacity, 0);
  const booked = todaySessions.reduce((sum, session) => sum + session.booked_count, 0);
  const occupancyToday = capacity === 0 ? 0 : Math.round((booked / capacity) * 100);

  const expiringSoon = memberships.filter((item) => {
    const days = (Date.parse(`${item.expires_at}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
    return days >= 0 && days <= 7;
  }).length;

  return {
    activeCustomers: customers.length,
    activeMemberships: memberships.length,
    bookingsToday: todayBookings.filter((item) => item.status === 'BOOKED' || item.status === 'ATTENDED').length,
    attendanceThisMonth: monthAttendance.length,
    classesToday: todaySessions.length,
    occupancyToday,
    membershipsExpiringSoon: expiringSoon,
    clientsAtRisk: expiringSoon,
  };
}

export function serializeSession(session: ClassSessionDetails, timezone: string) {
  const start = new Date(session.starts_at);
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(start);
  const [date, time] = local.split(' ');
  return {
    id: session.id,
    locationId: session.location_id,
    locationName: session.location_name,
    locationAddress: session.location_address,
    activityId: session.activity_id,
    activityName: session.activity_name,
    activityImage: session.activity_image,
    trainerId: session.trainer_id,
    trainerName: session.trainer_name,
    trainerPhoto: session.trainer_photo,
    trainerSpecialization: session.trainer_specialization,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    date,
    time,
    durationMinutes: session.duration_minutes,
    capacity: session.capacity,
    bookedCount: session.booked_count,
    spotsLeft: session.spots_left,
    status: session.status,
  };
}

export function serializeBooking(booking: BookingDetails, timezone: string) {
  return {
    id: booking.id,
    customerId: booking.customer_id,
    customerName: `${booking.customer_first_name} ${booking.customer_last_name}`.trim(),
    classSessionId: booking.class_session_id,
    membershipId: booking.customer_membership_id,
    membershipName: booking.membership_name,
    status: booking.status,
    bookedAt: booking.booked_at,
    cancelledAt: booking.cancelled_at,
    attendedAt: booking.attended_at,
    session: serializeSession(booking.session, timezone),
  };
}

export function serializeMembership(balance: MembershipBalance) {
  return {
    id: balance.membership.id,
    customerId: balance.membership.customer_id,
    planId: balance.plan.id,
    name: balance.plan.name,
    membershipType: balance.plan.membership_type,
    status: balance.membership.status,
    startsAt: balance.membership.starts_at,
    expiresAt: balance.membership.expires_at,
    totalVisits: balance.membership.total_visits,
    remainingVisits: balance.remaining,
    usedVisits: balance.used,
    reservedVisits: balance.reserved,
    bookableVisits: balance.bookable,
    freezeFrom: balance.membership.freeze_from,
    freezeUntil: balance.membership.freeze_until,
    description: balance.plan.description,
  };
}

export function buildCustomerPortal(providers: Providers, telegramUserId: number, timezone: string) {
  const customer = providers.customers.getByTelegramUserId(telegramUserId);
  if (!customer) return null;
  const club = providers.club.getClub();
  const memberships = providers.memberships
    .listCustomerMemberships(customer.id)
    .map((item) => serializeMembership(calculateMembershipBalance(providers, item.id)));
  const active =
    memberships.find((item) => item.status === 'ACTIVE') ??
    memberships.find((item) => item.status === 'FROZEN') ??
    memberships[0] ??
    null;
  const bookings = providers.bookings.listByCustomer(customer.id).map((item) => serializeBooking(item, timezone));
  const nowIso = new Date().toISOString();
  const nextWorkout =
    bookings
      .filter((item) => item.status === 'BOOKED' && item.session.startsAt >= nowIso)
      .sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt))[0] ?? null;
  const progress = getCustomerProgress(providers, customer.id);

  return {
    club: {
      id: club.id,
      name: club.name,
      description: club.description,
      phone: club.phone,
      email: club.email,
      address: club.address,
      timezone: club.timezone,
    },
    customer: {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      email: customer.email,
      status: customer.status,
    },
    membership: active,
    memberships,
    nextWorkout,
    bookings,
    progress,
  };
}
