import { logger } from '../../logger.js';
import type { EventProvider } from '../types.js';

export function createWebhookEventPublisher(
  inner: EventProvider,
  webhookUrl: string,
): EventProvider {
  return {
    publish(name, payload) {
      const event = inner.publish(name, payload);
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            payload,
            id: event.id,
            createdAt: event.created_at,
          }),
        }).catch((error) => {
          logger.warn('Event webhook failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
      return event;
    },
    list(limit) {
      return inner.list(limit);
    },
  };
}
