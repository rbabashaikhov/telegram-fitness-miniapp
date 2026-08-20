import type { DemoTourDefinition } from './types';

export const FITNESS_DEMO_TOUR_STORAGE_KEY = 'fitness.salesDemoTour.v1';

export const fitnessDemoTour: DemoTourDefinition = {
  id: 'fitness-sales-demo',
  storageKey: FITNESS_DEMO_TOUR_STORAGE_KEY,
  intro: {
    title: 'Посмотреть, как клуб работает в Telegram?',
    lead: 'Это не каталог. Клиент сразу видит абонемент, ближайшую тренировку и риск оттока — на стороне клуба.',
    bullets: [
      'персональный кабинет, а не витрина',
      'запись на класс с проверкой абонемента',
      'посещение списывается после факта',
      'экран удержания для администратора',
    ],
    startLabel: 'Начать тур',
    skipLabel: 'Пропустить',
  },
  finish: {
    title: 'Запись, абонементы и удержание клиентов — внутри Telegram.',
    lead: 'Клуб видит, кому пора продлевать карту и кого рискует потерять. Mini App уже отделён от SQLite: для CRM нужен адаптер, а не новый интерфейс.',
    bullets: [
      'клиентский dashboard',
      'расписание и запись',
      'membership ledger',
      'admin + retention',
    ],
    adminLabel: 'Открыть удержание',
    continueLabel: 'Продолжить как клиент',
  },
  steps: [
    {
      id: 'dashboard',
      target: 'client-membership',
      route: '/',
      title: 'Кабинет клиента',
      description: 'Александр сразу видит Fitness Premium, срок и остаток посещений. Не каталог — персональный клуб.',
    },
    {
      id: 'schedule',
      target: 'schedule-list',
      route: '/schedule',
      title: 'Расписание',
      description: 'Классы на сегодня и дальше. Места считаются как capacity минус активные записи.',
    },
    {
      id: 'confirm',
      target: 'confirmation',
      route: '/schedule',
      title: 'Подтверждение',
      description: 'Перед записью видно абонемент. Посещение спишется только после фактической тренировки.',
      action: 'open-first-class',
    },
    {
      id: 'workouts',
      target: 'upcoming-workouts',
      route: '/workouts',
      title: 'Мои тренировки',
      description: 'Предстоящие записи можно отменить. Списания при отмене нет.',
    },
    {
      id: 'admin',
      target: 'admin-customers',
      route: '/demo/admin?tab=customers',
      title: 'Кабинет администратора',
      description: 'Клуб видит клиента, абонемент и запись. Отметка ATTENDED идёт через ledger.',
    },
    {
      id: 'attend',
      target: 'admin-bookings',
      route: '/demo/admin?tab=bookings',
      title: 'Посещение',
      description: 'Отметьте ATTENDED вручную — баланс уменьшится один раз. Тур сам записи не меняет.',
    },
    {
      id: 'retention',
      target: 'retention-list',
      route: '/demo/admin?tab=retention',
      title: 'Удержание',
      description: 'Истекающие абонементы, мало занятий, неактивные клиенты и серии отмен — на одном экране.',
    },
  ],
};
