import { logger } from '../../logger.js';
import type { NotificationProvider } from '../types.js';

export function createWebhookNotificationProvider(
  inner: NotificationProvider,
  webhookUrl: string,
): NotificationProvider {
  return {
    enqueue(params) {
      const record = inner.enqueue(params);
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: params.kind,
            customerId: params.customerId,
            title: params.title,
            body: params.body,
            id: record.id,
          }),
        }).catch((error) => {
          logger.warn('Notification webhook failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
      return { ...record, channel: 'webhook', status: 'queued' };
    },
    list(customerId) {
      return inner.list(customerId);
    },
  };
}
