import { config } from './config.js';
import { db } from './db/schema.js';
import { logger } from './logger.js';
import { createCrmProviders } from './providers/crm/stub.js';
import { createMockEventPublisher } from './providers/events/mock.js';
import { createWebhookEventPublisher } from './providers/events/webhook.js';
import { createLocalProviders } from './providers/local/sqlite.js';
import { createMockNotificationProvider } from './providers/notifications/mock.js';
import { createWebhookNotificationProvider } from './providers/notifications/webhook.js';
import type { Providers } from './providers/types.js';

function composeProviders(): Providers {
  if (config.dataMode === 'crm') {
    logger.warn('DATA_MODE=crm: using CRM provider stub. Partner adapter is not implemented.');
    return createCrmProviders();
  }

  const data = createLocalProviders(db);

  let events = data.events;
  if (config.eventAdapter === 'mock') {
    events = createMockEventPublisher();
  } else if (config.eventAdapter === 'webhook') {
    events = createWebhookEventPublisher(data.events, config.events.webhookUrl);
  }

  let notifications = data.notifications;
  if (config.notificationAdapter === 'mock') {
    notifications = createMockNotificationProvider();
  } else if (config.notificationAdapter === 'webhook') {
    notifications = createWebhookNotificationProvider(
      data.notifications,
      config.notifications.webhookUrl,
    );
  }

  logger.info('Providers composed', {
    dataMode: config.dataMode,
    eventAdapter: config.eventAdapter,
    notificationAdapter: config.notificationAdapter,
  });

  return {
    ...data,
    events,
    notifications,
  };
}

export const providers: Providers = composeProviders();
