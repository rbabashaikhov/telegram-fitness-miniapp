import type { Providers } from '../providers/types.js';
import type { ProgressSummary } from '../types.js';
import {
  addDaysIso,
  mondayOf,
  monthLabelRu,
  startOfMonth,
  startOfNextMonth,
  startOfPreviousMonth,
  todayDateString,
} from './time.js';

export function getCustomerProgress(
  providers: Providers,
  customerId: number,
  now = new Date(),
): ProgressSummary {
  const today = todayDateString(now);
  const thisMonthStart = startOfMonth(today);
  const nextMonthStart = startOfNextMonth(today);
  const prevMonthStart = startOfPreviousMonth(today);

  const attended = providers.bookings
    .list({ customerId, status: 'ATTENDED' })
    .filter((booking) => booking.session.status !== 'CANCELLED');

  const inRange = (from: string, to: string) =>
    attended.filter((booking) => {
      const date = booking.session.starts_at.slice(0, 10);
      return date >= from && date < to;
    });

  const thisMonth = inRange(thisMonthStart, nextMonthStart).length;
  const previousMonth = inRange(prevMonthStart, thisMonthStart).length;

  const weekCounts = new Map<string, number>();
  for (let i = 0; i < 8; i += 1) {
    const weekStart = mondayOf(addDaysIso(today, -i * 7));
    weekCounts.set(weekStart, 0);
  }
  for (const booking of attended) {
    const week = mondayOf(booking.session.starts_at.slice(0, 10));
    if (weekCounts.has(week)) {
      weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
    }
  }

  const weeks = [...weekCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, count]) => ({ weekStart, count }));

  let streakWeeks = 0;
  const recent = [...weeks].reverse();
  for (const week of recent) {
    if (week.count > 0) streakWeeks += 1;
    else break;
  }

  const activityCounts = new Map<number, { name: string; count: number }>();
  for (const booking of inRange(thisMonthStart, nextMonthStart)) {
    const current = activityCounts.get(booking.session.activity_id) ?? {
      name: booking.session.activity_name,
      count: 0,
    };
    current.count += 1;
    activityCounts.set(booking.session.activity_id, current);
  }

  const favouriteActivities = [...activityCounts.entries()]
    .map(([activityId, item]) => ({ activityId, ...item }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return {
    monthLabel: monthLabelRu(today),
    thisMonth,
    previousMonth,
    delta: thisMonth - previousMonth,
    streakWeeks,
    weekly: weeks.slice(-4),
    favouriteActivities,
  };
}
