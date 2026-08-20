import type Database from 'better-sqlite3';
import { createLocalProviders } from '../providers/local/sqlite.js';
import { createMockPaymentProvider } from '../providers/payments/mock.js';
import type { Providers } from '../providers/types.js';
import { refreshMembershipCache } from '../services/membership.js';
import { addDaysIso, addMinutesIso, localDateTimeToUtcIso, todayDateString, zonedParts } from '../services/time.js';

const TZ = process.env.TZ || 'Europe/Moscow';

const IMAGES = {
  functional: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
  yoga: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80',
  pilates: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80',
  stretching: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80',
  boxing: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=80',
  cycle: 'https://images.unsplash.com/photo-1534787238916-9ba2624b63e0?auto=format&fit=crop&w=1200&q=80',
  strength: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
  hiit: 'https://images.unsplash.com/photo-1517960413843-0aee8e2b3285?auto=format&fit=crop&w=1200&q=80',
};

const PHOTOS = {
  anna: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&w=640&q=80',
  dmitry: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&w=640&q=80',
  elena: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=640&q=80',
  maxim: 'https://images.unsplash.com/photo-1571731956672-f2b94d7dd0cb?auto=format&fit=crop&w=640&q=80',
  sofia: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=640&q=80',
  igor: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=640&q=80',
};

export const DEMO_TELEGRAM_ID = 999000001;

export function seed(database: Database.Database, now = new Date()): void {
  const existing = database.prepare('SELECT id FROM clubs LIMIT 1').get() as { id: number } | undefined;
  if (existing) return;

  const providers: Providers = {
    ...createLocalProviders(database),
    payments: createMockPaymentProvider(),
  };
  const today = todayDateString(now, TZ);

  database
    .prepare(
      `INSERT INTO clubs (name, description, phone, email, address, timezone)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      'Pulse Fitness Club',
      'Современный фитнес-клуб в центре Москвы: групповые тренировки, персональные занятия и понятный абонемент в Telegram.',
      '+7 495 120-40-18',
      'hello@pulsefitness.club',
      'Москва, Пресненская наб. 12',
      TZ,
    );

  const club = providers.club.getClub();
  database
    .prepare('INSERT INTO locations (club_id, name, address, timezone, active) VALUES (?, ?, ?, ?, 1)')
    .run(club.id, 'Pulse Arena', 'Москва, Пресненская наб. 12', TZ);
  database
    .prepare('INSERT INTO locations (club_id, name, address, timezone, active) VALUES (?, ?, ?, ?, 1)')
    .run(club.id, 'Pulse Studio', 'Москва, Садовническая ул. 14', TZ);

  const [arena, studio] = providers.club.listLocations();

  const anna = providers.trainers.create({
    location_id: arena.id,
    name: 'Анна Смирнова',
    photo: PHOTOS.anna,
    specialization: 'Functional · HIIT',
    description: 'Ведёт функциональные классы и утренние HIIT. 8 лет в групповых программах.',
    active: true,
  });
  const dmitry = providers.trainers.create({
    location_id: arena.id,
    name: 'Дмитрий Орлов',
    photo: PHOTOS.dmitry,
    specialization: 'Strength · Boxing',
    description: 'Силовые программы и бокс. Помогает новичкам держать технику под нагрузкой.',
    active: true,
  });
  const elena = providers.trainers.create({
    location_id: studio.id,
    name: 'Елена Васильева',
    photo: PHOTOS.elena,
    specialization: 'Yoga · Pilates',
    description: 'Мягкая силовая работа, дыхание и контроль корпуса. Студия Pulse Studio.',
    active: true,
  });
  const maxim = providers.trainers.create({
    location_id: arena.id,
    name: 'Максим Кузнецов',
    photo: PHOTOS.maxim,
    specialization: 'Cycle',
    description: 'Вечерние cycle-классы с понятной прогрессией и без лишнего шума.',
    active: true,
  });
  const sofia = providers.trainers.create({
    location_id: studio.id,
    name: 'София Лебедева',
    photo: PHOTOS.sofia,
    specialization: 'Stretching · Mobility',
    description: 'Восстановление и мобильность после силовых и функциональных тренировок.',
    active: true,
  });
  const igor = providers.trainers.create({
    location_id: arena.id,
    name: 'Игорь Новиков',
    photo: PHOTOS.igor,
    specialization: 'Boxing · Functional',
    description: 'Бокс для любителей и вечерний functional. Держит высокий, но спокойный темп.',
    active: true,
  });

  const functional = providers.activities.create({
    name: 'Functional Training',
    description: 'Круговая работа с весом тела и свободными весами. 45 минут, средний уровень.',
    duration_minutes: 45,
    capacity_default: 14,
    image: IMAGES.functional,
    active: true,
  });
  const yoga = providers.activities.create({
    name: 'Yoga',
    description: 'Динамическая йога с акцентом на силу корпуса и подвижность.',
    duration_minutes: 60,
    capacity_default: 16,
    image: IMAGES.yoga,
    active: true,
  });
  const pilates = providers.activities.create({
    name: 'Pilates',
    description: 'Контроль, дыхание и стабилизация. Подходит после силовых циклов.',
    duration_minutes: 50,
    capacity_default: 12,
    image: IMAGES.pilates,
    active: true,
  });
  const stretching = providers.activities.create({
    name: 'Stretching',
    description: 'Мягкая растяжка и восстановление. Вечерние классы в Pulse Studio.',
    duration_minutes: 40,
    capacity_default: 14,
    image: IMAGES.stretching,
    active: true,
  });
  const boxing = providers.activities.create({
    name: 'Boxing',
    description: 'Техника удара, работа с мешком и короткие раунды. Без спарринга в групповом формате.',
    duration_minutes: 50,
    capacity_default: 10,
    image: IMAGES.boxing,
    active: true,
  });
  const cycle = providers.activities.create({
    name: 'Cycle',
    description: 'Интервальная езда. Понятные зоны нагрузки, без агрессивной подачи.',
    duration_minutes: 45,
    capacity_default: 18,
    image: IMAGES.cycle,
    active: true,
  });
  const strength = providers.activities.create({
    name: 'Strength',
    description: 'Базовая сила: присед, тяга, жим в формате малого класса.',
    duration_minutes: 55,
    capacity_default: 10,
    image: IMAGES.strength,
    active: true,
  });
  const hiit = providers.activities.create({
    name: 'HIIT',
    description: 'Короткие интервалы, высокий пульс, ясные раунды.',
    duration_minutes: 30,
    capacity_default: 16,
    image: IMAGES.hiit,
    active: true,
  });

  const dropIn = providers.memberships.createPlan({
    name: 'Разовое посещение',
    membership_type: 'VISIT_BASED',
    duration_days: 7,
    visit_limit: 1,
    price: 1500,
    description: 'Одно групповое занятие. Удобно попробовать клуб без абонемента.',
    active: true,
  });
  const visits8 = providers.memberships.createPlan({
    name: '8 посещений',
    membership_type: 'VISIT_BASED',
    duration_days: 45,
    visit_limit: 8,
    price: 8900,
    description: '8 групповых тренировок. Списание после фактического посещения.',
    active: true,
  });
  const visits12 = providers.memberships.createPlan({
    name: '12 посещений',
    membership_type: 'VISIT_BASED',
    duration_days: 60,
    visit_limit: 12,
    price: 12900,
    description: '12 занятий на два месяца. Удобный старт без безлимита.',
    active: true,
  });
  const unlimited = providers.memberships.createPlan({
    name: 'Безлимит на месяц',
    membership_type: 'UNLIMITED',
    duration_days: 30,
    visit_limit: null,
    price: 9900,
    description: 'Безлимит групповых классов на 30 дней.',
    active: true,
  });
  const personal8 = providers.memberships.createPlan({
    name: 'Personal Training 8',
    membership_type: 'VISIT_BASED',
    duration_days: 60,
    visit_limit: 8,
    price: 32000,
    description: '8 персональных слотов. Для силовой и технической работы.',
    active: true,
  });
  const premium = providers.memberships.createPlan({
    name: 'Fitness Premium',
    membership_type: 'VISIT_BASED',
    duration_days: 90,
    visit_limit: 16,
    price: 18900,
    description: '16 посещений групповых классов. Списание после фактической тренировки.',
    active: true,
  });

  const people: Array<{
    first: string;
    last: string;
    phone: string;
    email: string;
    telegram?: number;
    tag?: string;
  }> = [
    {
      first: 'Александр',
      last: 'Волков',
      phone: '+7 916 450-11-28',
      email: 'alexander.volkov@example.com',
      telegram: DEMO_TELEGRAM_ID,
      tag: 'demo',
    },
    { first: 'Мария', last: 'Соколова', phone: '+7 903 221-40-17', email: 'maria.sokolova@example.com', tag: 'expiring' },
    { first: 'Алексей', last: 'Иванов', phone: '+7 926 118-33-90', email: 'alexey.ivanov@example.com', tag: 'low' },
    { first: 'Иван', last: 'Петров', phone: '+7 910 776-02-44', email: 'ivan.petrov@example.com', tag: 'inactive' },
    { first: 'Ольга', last: 'Орлова', phone: '+7 915 330-61-08', email: 'olga.orlova@example.com', tag: 'cancels' },
    { first: 'Ксения', last: 'Морозова', phone: '+7 925 441-19-73', email: 'ksenia.morozova@example.com', tag: 'noshow' },
    { first: 'Никита', last: 'Белов', phone: '+7 903 555-28-14', email: 'nikita.belov@example.com' },
    { first: 'Дарья', last: 'Кузьмина', phone: '+7 916 882-07-35', email: 'daria.kuzmina@example.com' },
    { first: 'Павел', last: 'Егоров', phone: '+7 926 190-44-62', email: 'pavel.egorov@example.com' },
    { first: 'Анна', last: 'Фролова', phone: '+7 909 271-53-80', email: 'anna.frolova@example.com' },
    { first: 'Сергей', last: 'Михайлов', phone: '+7 915 604-12-97', email: 'sergey.mikhailov@example.com' },
    { first: 'Екатерина', last: 'Новикова', phone: '+7 903 718-25-41', email: 'ekaterina.novikova@example.com' },
    { first: 'Андрей', last: 'Соловьёв', phone: '+7 926 333-08-59', email: 'andrey.solovyov@example.com' },
    { first: 'Полина', last: 'Зайцева', phone: '+7 910 447-61-22', email: 'polina.zaitseva@example.com' },
    { first: 'Роман', last: 'Киселёв', phone: '+7 916 229-70-13', email: 'roman.kiselev@example.com' },
    { first: 'Виктория', last: 'Павлова', phone: '+7 925 156-38-04', email: 'victoria.pavlova@example.com' },
    { first: 'Глеб', last: 'Тихонов', phone: '+7 903 964-11-75', email: 'gleb.tikhonov@example.com' },
    { first: 'Алина', last: 'Комарова', phone: '+7 915 802-47-30', email: 'alina.komarova@example.com' },
    { first: 'Денис', last: 'Савельев', phone: '+7 926 670-19-88', email: 'denis.savelyev@example.com' },
    { first: 'Юлия', last: 'Громова', phone: '+7 909 513-26-41', email: 'yulia.gromova@example.com' },
    { first: 'Артём', last: 'Баранов', phone: '+7 916 734-08-52', email: 'artem.baranov@example.com' },
    { first: 'Софья', last: 'Власова', phone: '+7 910 288-65-19', email: 'sofia.vlasova@example.com' },
    { first: 'Кирилл', last: 'Медведев', phone: '+7 925 401-33-76', email: 'kirill.medvedev@example.com' },
    { first: 'Наталья', last: 'Ершова', phone: '+7 903 147-90-28', email: 'natalia.ershova@example.com' },
    { first: 'Михаил', last: 'Лапин', phone: '+7 915 256-44-03', email: 'mikhail.lapin@example.com' },
  ];

  const customers = people.map((person, index) => {
    const { customer } = providers.customers.upsert(
      {
        id: person.telegram ?? 8_100_000 + index,
        first_name: person.first,
        last_name: person.last,
        username: person.telegram ? 'demo_client' : undefined,
      },
      { phone: person.phone, email: person.email },
    );
    return { ...customer, tag: person.tag };
  });

  const byTag = (tag: string) => customers.find((item) => item.tag === tag)!;

  function issue(
    customerId: number,
    planId: number,
    startsAt: string,
    expiresAt: string,
    remaining: number | null,
    status: 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED' | 'FROZEN' = 'ACTIVE',
  ) {
    const plan = providers.memberships.getPlan(planId)!;
    const total = plan.membership_type === 'VISIT_BASED' ? plan.visit_limit : null;
    const membership = providers.memberships.createCustomerMembership({
      customer_id: customerId,
      membership_plan_id: planId,
      starts_at: startsAt,
      expires_at: expiresAt,
      total_visits: total,
      remaining_visits: remaining,
      status,
      freeze_from: status === 'FROZEN' ? addDaysIso(today, -5) : null,
      freeze_until: status === 'FROZEN' ? addDaysIso(today, 10) : null,
    });
    providers.memberships.insertLedger({
      customerMembershipId: membership.id,
      operation: 'PURCHASE',
      delta: total ?? 0,
      reason: `Issued ${plan.name}`,
    });
    if (plan.membership_type === 'VISIT_BASED' && remaining !== null && total !== null && remaining < total) {
      providers.memberships.insertLedger({
        customerMembershipId: membership.id,
        operation: 'ADJUSTMENT',
        delta: remaining - total,
        reason: 'Opening balance from previous visits',
      });
    }
    return membership;
  }

  const demo = byTag('demo');
  const previousDemo = issue(
    demo.id,
    visits12.id,
    addDaysIso(today, -70),
    addDaysIso(today, -2),
    4,
    'EXHAUSTED',
  );
  const demoMembership = issue(demo.id, premium.id, addDaysIso(today, -49), addDaysIso(today, 41), 16);

  issue(byTag('expiring').id, unlimited.id, addDaysIso(today, -26), addDaysIso(today, 4), null);
  issue(byTag('low').id, visits12.id, addDaysIso(today, -40), addDaysIso(today, 20), 2);
  issue(byTag('inactive').id, premium.id, addDaysIso(today, -30), addDaysIso(today, 60), 9);
  issue(byTag('cancels').id, visits12.id, addDaysIso(today, -10), addDaysIso(today, 50), 10);
  issue(byTag('noshow').id, visits12.id, addDaysIso(today, -20), addDaysIso(today, 40), 8);

  for (const customer of customers) {
    if (customer.tag) continue;
    const plan = customer.id % 2 === 0 ? unlimited : visits12;
    const remaining = plan.membership_type === 'VISIT_BASED' ? 6 + (customer.id % 5) : null;
    const status = customer.id % 9 === 0 ? 'EXPIRED' : 'ACTIVE';
    issue(
      customer.id,
      plan.id,
      addDaysIso(today, status === 'EXPIRED' ? -80 : -20),
      addDaysIso(today, status === 'EXPIRED' ? -5 : 25 + (customer.id % 20)),
      remaining,
      status,
    );
  }

  void dropIn;
  void visits8;
  void personal8;

  const weekPlan: Array<{
    weekday: number;
    time: string;
    activityId: number;
    trainerId: number;
    locationId: number;
  }> = [
    { weekday: 1, time: '08:00', activityId: yoga.id, trainerId: elena.id, locationId: studio.id },
    { weekday: 1, time: '19:00', activityId: functional.id, trainerId: anna.id, locationId: arena.id },
    { weekday: 2, time: '07:30', activityId: hiit.id, trainerId: anna.id, locationId: arena.id },
    { weekday: 2, time: '18:30', activityId: boxing.id, trainerId: igor.id, locationId: arena.id },
    { weekday: 2, time: '19:30', activityId: pilates.id, trainerId: elena.id, locationId: studio.id },
    { weekday: 3, time: '08:00', activityId: stretching.id, trainerId: sofia.id, locationId: studio.id },
    { weekday: 3, time: '19:00', activityId: functional.id, trainerId: anna.id, locationId: arena.id },
    { weekday: 3, time: '20:00', activityId: cycle.id, trainerId: maxim.id, locationId: arena.id },
    { weekday: 4, time: '07:30', activityId: strength.id, trainerId: dmitry.id, locationId: arena.id },
    { weekday: 4, time: '18:00', activityId: yoga.id, trainerId: elena.id, locationId: studio.id },
    { weekday: 4, time: '19:00', activityId: boxing.id, trainerId: dmitry.id, locationId: arena.id },
    { weekday: 5, time: '08:00', activityId: hiit.id, trainerId: igor.id, locationId: arena.id },
    { weekday: 5, time: '18:30', activityId: functional.id, trainerId: anna.id, locationId: arena.id },
    { weekday: 5, time: '19:30', activityId: cycle.id, trainerId: maxim.id, locationId: arena.id },
    { weekday: 6, time: '10:00', activityId: yoga.id, trainerId: elena.id, locationId: studio.id },
    { weekday: 6, time: '12:00', activityId: functional.id, trainerId: anna.id, locationId: arena.id },
    { weekday: 6, time: '16:00', activityId: stretching.id, trainerId: sofia.id, locationId: studio.id },
    { weekday: 0, time: '11:00', activityId: pilates.id, trainerId: elena.id, locationId: studio.id },
    { weekday: 0, time: '17:00', activityId: cycle.id, trainerId: maxim.id, locationId: arena.id },
  ];

  const sessionsByKey = new Map<string, number>();
  for (let offset = -21; offset <= 14; offset += 1) {
    const date = addDaysIso(today, offset);
    const [y, m, d] = date.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    for (const slot of weekPlan.filter((item) => item.weekday === weekday)) {
      const activity = providers.activities.getById(slot.activityId)!;
      const starts = localDateTimeToUtcIso(date, slot.time, TZ);
      const ends = addMinutesIso(starts, activity.duration_minutes);
      const created = providers.schedule.createSession({
        location_id: slot.locationId,
        activity_id: slot.activityId,
        trainer_id: slot.trainerId,
        starts_at: starts,
        ends_at: ends,
        capacity: activity.capacity_default,
        status: offset < -1 && offset % 11 === 0 ? 'COMPLETED' : 'SCHEDULED',
      });
      sessionsByKey.set(`${date}-${slot.time}-${slot.activityId}`, created.id);
    }
  }

  function sessionOn(date: string, time: string, activityId: number): number | undefined {
    return sessionsByKey.get(`${date}-${time}-${activityId}`);
  }

  function anySessionOn(date: string): number | undefined {
    for (const [key, id] of sessionsByKey) {
      if (key.startsWith(`${date}-`)) return id;
    }
    return undefined;
  }

  function book(params: {
    customerId: number;
    membershipId?: number | null;
    sessionId: number;
    status: 'BOOKED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
    daysAgo?: number;
  }) {
    const booking = providers.bookings.insert({
      customerId: params.customerId,
      classSessionId: params.sessionId,
      customerMembershipId: params.membershipId ?? null,
    });
    if (params.status === 'BOOKED') return booking;
    if (params.status === 'CANCELLED') {
      return providers.bookings.updateStatus(booking.id, 'CANCELLED', {
        cancelledAt: new Date(now.getTime() - (params.daysAgo ?? 1) * 86_400_000).toISOString(),
      });
    }
    if (params.status === 'NO_SHOW') {
      return providers.bookings.updateStatus(booking.id, 'NO_SHOW', {
        cancelledAt: new Date(now.getTime() - (params.daysAgo ?? 1) * 86_400_000).toISOString(),
      });
    }
    const attended = providers.bookings.updateStatus(booking.id, 'ATTENDED', {
      attendedAt: new Date(now.getTime() - (params.daysAgo ?? 1) * 86_400_000).toISOString(),
    });
    if (params.membershipId) {
      const existing = providers.memberships.findRedeemForBooking(attended.id);
      if (!existing) {
        const membership = providers.memberships.getCustomerMembership(params.membershipId);
        const plan = membership ? providers.memberships.getPlan(membership.membership_plan_id) : undefined;
        if (plan?.membership_type === 'VISIT_BASED') {
          providers.memberships.insertLedger({
            customerMembershipId: params.membershipId,
            bookingId: attended.id,
            operation: 'REDEEM',
            delta: -1,
            reason: 'Attended class',
          });
        }
      }
    }
    return attended;
  }

  let demoAttended = 0;
  for (let offset = 2; offset <= 24 && demoAttended < 8; offset += 1) {
    const sid = anySessionOn(addDaysIso(today, -offset));
    if (!sid) continue;
    book({
      customerId: demo.id,
      membershipId: demoAttended < 4 ? previousDemo.id : demoMembership.id,
      sessionId: sid,
      status: 'ATTENDED',
      daysAgo: offset,
    });
    demoAttended += 1;
  }

  const localNow = zonedParts(now, TZ);
  const nextDate = localNow.hour < 19 ? today : addDaysIso(today, 1);
  const nextFunctional =
    sessionOn(nextDate, '19:00', functional.id) ||
    sessionOn(nextDate, '18:30', functional.id) ||
    sessionOn(addDaysIso(today, 1), '19:00', functional.id);
  if (nextFunctional) {
    book({
      customerId: demo.id,
      membershipId: demoMembership.id,
      sessionId: nextFunctional,
      status: 'BOOKED',
    });
  }

  const tomorrowYoga = sessionOn(addDaysIso(today, 1), '08:00', yoga.id);
  if (tomorrowYoga) {
    book({
      customerId: demo.id,
      membershipId: demoMembership.id,
      sessionId: tomorrowYoga,
      status: 'BOOKED',
    });
  }

  const cancelClient = byTag('cancels');
  const cancelMembership = providers.memberships.listCustomerMemberships(cancelClient.id)[0];
  let cancelledCount = 0;
  for (let offset = 1; offset <= 14 && cancelledCount < 3; offset += 1) {
    const sid = anySessionOn(addDaysIso(today, offset));
    if (!sid) continue;
    book({
      customerId: cancelClient.id,
      membershipId: cancelMembership?.id,
      sessionId: sid,
      status: 'CANCELLED',
      daysAgo: 0,
    });
    cancelledCount += 1;
  }

  const noshow = byTag('noshow');
  const noshowMembership = providers.memberships.listCustomerMemberships(noshow.id)[0];
  let noShowCount = 0;
  for (let offset = 2; offset <= 20 && noShowCount < 2; offset += 1) {
    const sid = anySessionOn(addDaysIso(today, -offset));
    if (!sid) continue;
    book({
      customerId: noshow.id,
      membershipId: noshowMembership?.id,
      sessionId: sid,
      status: 'NO_SHOW',
      daysAgo: offset,
    });
    noShowCount += 1;
  }

  const inactive = byTag('inactive');
  const inactiveMembership = providers.memberships.listCustomerMemberships(inactive.id)[0];
  const oldSession =
    anySessionOn(addDaysIso(today, -13)) || anySessionOn(addDaysIso(today, -14));
  if (oldSession) {
    book({
      customerId: inactive.id,
      membershipId: inactiveMembership?.id,
      sessionId: oldSession,
      status: 'ATTENDED',
      daysAgo: 13,
    });
  }

  const others = customers.filter((item) => !item.tag);
  for (let i = 0; i < others.length; i += 1) {
    const customer = others[i];
    const membership = providers.memberships.listCustomerMemberships(customer.id)[0];
    const date = addDaysIso(today, -((i % 10) + 1));
    const sid =
      sessionOn(date, '19:00', functional.id) ||
      sessionOn(date, '18:00', yoga.id) ||
      sessionOn(date, '20:00', cycle.id);
    if (sid && membership?.status === 'ACTIVE') {
      const status = i % 7 === 0 ? 'CANCELLED' : i % 11 === 0 ? 'NO_SHOW' : 'ATTENDED';
      book({
        customerId: customer.id,
        membershipId: membership.id,
        sessionId: sid,
        status,
        daysAgo: (i % 10) + 1,
      });
    }
    const future = addDaysIso(today, (i % 6) + 1);
    const futureSid =
      sessionOn(future, '19:00', functional.id) ||
      sessionOn(future, '18:30', functional.id) ||
      sessionOn(future, '10:00', yoga.id);
    if (futureSid && membership?.status === 'ACTIVE' && i % 3 === 0) {
      try {
        book({
          customerId: customer.id,
          membershipId: membership.id,
          sessionId: futureSid,
          status: 'BOOKED',
        });
      } catch {
        // unique booking or capacity — skip
      }
    }
  }

  providers.customers.addNote(demo.id, 'Любит вечерний Functional с Анной. Продлевает абонемент без напоминаний.');
  providers.customers.addNote(byTag('expiring').id, 'Абонемент Unlimited заканчивается на этой неделе. Предложить продление.');
  providers.customers.addNote(byTag('inactive').id, 'Пропал после отпуска. Раньше ходил 3 раза в неделю.');
  providers.customers.addNote(byTag('cancels').id, 'Часто отменяет вечерние классы в последний момент.');

  for (const membership of providers.memberships.listCustomerMemberships()) {
    refreshMembershipCache(providers, membership.id);
  }
}
