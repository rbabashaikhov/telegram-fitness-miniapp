function boolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function numberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
const allowDemoMode =
  process.env.ALLOW_DEMO_MODE === 'true' ||
  nodeEnv !== 'production' ||
  !telegramBotToken;

export type DataModeName = 'local' | 'crm';
export type EventAdapterName = 'local' | 'webhook' | 'mock';
export type NotificationAdapterName = 'local' | 'mock' | 'webhook';
export type PaymentAdapterName = 'mock' | 'external';

function dataModeName(value: string | undefined): DataModeName {
  if (value === 'crm' || value === 'local') return value;
  return 'local';
}

function eventAdapterName(value: string | undefined): EventAdapterName {
  if (value === 'webhook' || value === 'mock' || value === 'local') return value;
  return 'local';
}

function notificationAdapterName(value: string | undefined): NotificationAdapterName {
  if (value === 'webhook' || value === 'mock' || value === 'local') return value;
  return 'local';
}

function paymentAdapterName(value: string | undefined): PaymentAdapterName {
  if (value === 'external' || value === 'mock') return value;
  return 'mock';
}

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.API_PORT || process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  databasePath: process.env.DATABASE_PATH || '',
  publicDir: process.env.PUBLIC_DIR || '',
  telegramBotToken,
  allowDemoMode,
  timezone: process.env.TZ || 'Europe/Moscow',
  dataMode: dataModeName(process.env.DATA_MODE),
  eventAdapter: eventAdapterName(process.env.EVENT_ADAPTER),
  notificationAdapter: notificationAdapterName(process.env.NOTIFICATION_ADAPTER),
  paymentAdapter: paymentAdapterName(process.env.PAYMENT_ADAPTER),
  business: {
    name: process.env.BUSINESS_NAME || 'Pulse Fitness Club',
    title: process.env.APP_TITLE || 'Pulse Fitness Club',
    description:
      process.env.APP_DESCRIPTION ||
      'Персональный кабинет фитнес-клуба: абонемент, расписание и запись на тренировки.',
    brandAccent: process.env.BRAND_ACCENT || '#C6FF4A',
    logoUrl: process.env.BRAND_LOGO_URL || '',
  },
  retention: {
    expiringDays: numberEnv(process.env.RETENTION_EXPIRING_DAYS, 7),
    inactiveDays: numberEnv(process.env.RETENTION_INACTIVE_DAYS, 12),
    lowVisits: numberEnv(process.env.RETENTION_LOW_VISITS, 2),
    consecutiveCancellations: numberEnv(process.env.RETENTION_CANCEL_STREAK, 3),
    noShowWindowDays: numberEnv(process.env.RETENTION_NOSHOW_WINDOW_DAYS, 30),
    noShowCount: numberEnv(process.env.RETENTION_NOSHOW_COUNT, 2),
  },
  features: {
    demoTour: boolEnv(process.env.FEATURE_DEMO_TOUR, true),
    demoAdminPreview: boolEnv(process.env.FEATURE_DEMO_ADMIN_PREVIEW, true),
  },
  admin: {
    token: (process.env.ADMIN_TOKEN || '').trim(),
  },
  events: {
    webhookUrl: process.env.EVENT_WEBHOOK_URL || '',
    webhookSecret: process.env.EVENT_WEBHOOK_SECRET || '',
    timeoutMs: numberEnv(process.env.EVENT_WEBHOOK_TIMEOUT_MS, 5000),
  },
  notifications: {
    webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL || '',
  },
  rateLimit: {
    windowMs: numberEnv(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: numberEnv(process.env.RATE_LIMIT_MAX, 20),
  },
};

export function publicAppConfig() {
  return {
    businessName: config.business.name,
    appTitle: config.business.title,
    appDescription: config.business.description,
    timezone: config.timezone,
    demoMode: config.allowDemoMode,
    adminProtected: Boolean(config.admin.token) || config.isProduction,
    branding: {
      accent: config.business.brandAccent,
      logoUrl: config.business.logoUrl || null,
    },
    features: {
      demoTour: config.features.demoTour,
      demoAdminPreview: config.features.demoAdminPreview,
    },
    retention: {
      expiringDays: config.retention.expiringDays,
      lowVisits: config.retention.lowVisits,
    },
  };
}

export function isDemoAdminPreviewEnabled(
  cfg: {
    allowDemoMode: boolean;
    features: { demoAdminPreview: boolean };
  } = config,
): boolean {
  return cfg.allowDemoMode && cfg.features.demoAdminPreview;
}

export function isAdminWriteLocked(token: string): boolean {
  return token.length === 0;
}
