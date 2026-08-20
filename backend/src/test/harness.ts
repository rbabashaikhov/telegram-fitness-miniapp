import Database from 'better-sqlite3';
import { migrate } from '../db/schema.js';
import { seed } from '../db/seed.js';
import { createLocalProviders } from '../providers/local/sqlite.js';
import { createMockPaymentProvider } from '../providers/payments/mock.js';
import type { Providers } from '../providers/types.js';
import { addDaysIso, localDateTimeToUtcIso, todayDateString } from '../services/time.js';

export interface TestWorld {
  db: Database.Database;
  providers: Providers;
  now: Date;
  today: string;
  futureDate: string;
  customer: { id: number; telegramUserId: number };
  trainerId: number;
  activityId: number;
  locationId: number;
  planVisitId: number;
  planUnlimitedId: number;
}

function withMockPayments(data: Omit<Providers, 'payments'>): Providers {
  return { ...data, payments: createMockPaymentProvider() };
}

export function createTestWorld(now = new Date('2026-08-18T09:00:00+03:00')): TestWorld {
  const db = new Database(':memory:');
  migrate(db);
  const providers = withMockPayments(createLocalProviders(db));
  const today = todayDateString(now, 'Europe/Moscow');

  db.prepare(
    `INSERT INTO clubs (name, description, phone, email, address, timezone)
     VALUES ('Pulse Test', '', '', '', '', 'Europe/Moscow')`,
  ).run();
  const club = providers.club.getClub();
  db.prepare(
    'INSERT INTO locations (club_id, name, address, timezone, active) VALUES (?, ?, ?, ?, 1)',
  ).run(club.id, 'Arena', 'Moscow', 'Europe/Moscow');
  const location = providers.club.listLocations()[0];

  const trainer = providers.trainers.create({
    location_id: location.id,
    name: 'Анна Смирнова',
    photo: '',
    specialization: 'Functional',
    description: 'Test trainer',
    active: true,
  });
  const activity = providers.activities.create({
    name: 'Functional Training',
    description: 'Test class',
    duration_minutes: 45,
    capacity_default: 2,
    image: '',
    active: true,
  });
  const planVisit = providers.memberships.createPlan({
    name: '12 Visits',
    membership_type: 'VISIT_BASED',
    duration_days: 60,
    visit_limit: 12,
    price: 10000,
    description: '',
    active: true,
  });
  const planUnlimited = providers.memberships.createPlan({
    name: 'Unlimited',
    membership_type: 'UNLIMITED',
    duration_days: 30,
    visit_limit: null,
    price: 9000,
    description: '',
    active: true,
  });

  const user = { id: 1001, first_name: 'Александр', last_name: 'Тестов' };
  const { customer } = providers.customers.upsert(user);

  return {
    db,
    providers,
    now,
    today,
    futureDate: addDaysIso(today, 3),
    customer: { id: customer.id, telegramUserId: user.id },
    trainerId: trainer.id,
    activityId: activity.id,
    locationId: location.id,
    planVisitId: planVisit.id,
    planUnlimitedId: planUnlimited.id,
  };
}

export function createFutureSession(
  world: TestWorld,
  params?: { capacity?: number; date?: string; time?: string; status?: 'SCHEDULED' | 'CANCELLED' },
) {
  const date = params?.date ?? world.futureDate;
  const time = params?.time ?? '19:00';
  const starts = localDateTimeToUtcIso(date, time, 'Europe/Moscow');
  const ends = new Date(new Date(starts).getTime() + 45 * 60_000).toISOString();
  return world.providers.schedule.createSession({
    location_id: world.locationId,
    activity_id: world.activityId,
    trainer_id: world.trainerId,
    starts_at: starts,
    ends_at: ends,
    capacity: params?.capacity ?? 2,
    status: params?.status ?? 'SCHEDULED',
  });
}

export function seedDemoDb(now = new Date('2026-08-18T09:00:00+03:00')) {
  const db = new Database(':memory:');
  migrate(db);
  seed(db, now);
  return { db, providers: withMockPayments(createLocalProviders(db)) };
}
