import { config } from '../config.js';
import type { Providers } from '../providers/types.js';
import type { RetentionSignal } from '../types.js';
import { calculateMembershipBalance } from './membership.js';
import { daysBetween, todayDateString } from './time.js';

export function listRetentionSignals(
  providers: Providers,
  now = new Date(),
): RetentionSignal[] {
  const today = todayDateString(now);
  const customers = providers.customers.listAll().filter((customer) => customer.status !== 'ARCHIVED');
  const signals: RetentionSignal[] = [];

  for (const customer of customers) {
    const name = `${customer.first_name} ${customer.last_name}`.trim();
    const memberships = providers.memberships
      .listCustomerMemberships(customer.id)
      .map((membership) => calculateMembershipBalance(providers, membership.id));
    const active = memberships.filter(
      (item) => item.membership.status === 'ACTIVE' || item.membership.status === 'FROZEN',
    );

    for (const item of active) {
      const daysLeft = daysBetween(today, item.membership.expires_at);
      if (daysLeft >= 0 && daysLeft <= config.retention.expiringDays) {
        signals.push({
          kind: 'expiring',
          customerId: customer.id,
          customerName: name,
          phone: customer.phone,
          title: 'Абонемент заканчивается',
          detail:
            daysLeft === 0
              ? 'Абонемент заканчивается сегодня'
              : `Абонемент заканчивается через ${daysLeft} ${dayWord(daysLeft)}`,
          severity: daysLeft <= 3 ? 'high' : 'medium',
        });
      }
      if (
        item.plan.membership_type === 'VISIT_BASED' &&
        item.remaining !== null &&
        item.remaining <= config.retention.lowVisits
      ) {
        signals.push({
          kind: 'low_visits',
          customerId: customer.id,
          customerName: name,
          phone: customer.phone,
          title: 'Мало занятий',
          detail: `Осталось ${item.remaining} ${visitWord(item.remaining)}`,
          severity: item.remaining <= 1 ? 'high' : 'medium',
        });
      }
    }

    const bookings = providers.bookings.listByCustomer(customer.id);
    const lastVisit = bookings
      .filter((booking) => booking.status === 'ATTENDED')
      .sort((a, b) => b.session.starts_at.localeCompare(a.session.starts_at))[0];

    if (active.length && lastVisit) {
      const lastDate = lastVisit.session.starts_at.slice(0, 10);
      const idle = daysBetween(lastDate, today);
      if (idle >= config.retention.inactiveDays) {
        signals.push({
          kind: 'inactive',
          customerId: customer.id,
          customerName: name,
          phone: customer.phone,
          title: 'Давно не был в клубе',
          detail: `Не посещал клуб ${idle} ${dayWord(idle)}`,
          severity: idle >= 20 ? 'high' : 'medium',
        });
      }
    }

    const recent = [...bookings].sort((a, b) => b.booked_at.localeCompare(a.booked_at));
    const lastThree = recent.slice(0, 3);
    if (
      lastThree.length >= config.retention.consecutiveCancellations &&
      lastThree.every((booking) => booking.status === 'CANCELLED')
    ) {
      signals.push({
        kind: 'cancellations',
        customerId: customer.id,
        customerName: name,
        phone: customer.phone,
        title: 'Серия отмен',
        detail: `${lastThree.length} последних записи отменены`,
        severity: 'high',
      });
    }

    const windowStart = new Date(now.getTime() - config.retention.noShowWindowDays * 86_400_000).toISOString();
    const noShows = bookings.filter(
      (booking) => booking.status === 'NO_SHOW' && booking.session.starts_at >= windowStart,
    );
    if (noShows.length >= config.retention.noShowCount) {
      signals.push({
        kind: 'no_show',
        customerId: customer.id,
        customerName: name,
        phone: customer.phone,
        title: 'No-show',
        detail: `${noShows.length} no-show за последние ${config.retention.noShowWindowDays} дней`,
        severity: 'high',
      });
    }
  }

  const order = ['expiring', 'low_visits', 'inactive', 'cancellations', 'no_show'];
  return signals.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return order.indexOf(a.kind) - order.indexOf(b.kind);
  });
}

export function triggerRetentionAction(
  providers: Providers,
  params: {
    customerId: number;
    action: 'renewal_offer' | 'reminder';
  },
) {
  const customer = providers.customers.getById(params.customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  const title =
    params.action === 'renewal_offer' ? 'Предложение продления' : 'Напоминание о клубе';
  const body =
    params.action === 'renewal_offer'
      ? `${customer.first_name}, ваш абонемент скоро закончится. Продлите его в Pulse Fitness Club.`
      : `${customer.first_name}, мы вас ждём на тренировке в Pulse Fitness Club.`;

  const notification = providers.notifications.enqueue({
    customerId: customer.id,
    kind: params.action,
    title,
    body,
  });
  providers.events.publish('retention.triggered', {
    customerId: customer.id,
    action: params.action,
    notificationId: notification.id,
  });
  return notification;
}

function dayWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

function visitWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'тренировка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'тренировки';
  return 'тренировок';
}
