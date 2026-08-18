import type { NotificationProvider } from '../types.js';

export function createMockNotificationProvider(): NotificationProvider {
  return {
    enqueue(params) {
      return {
        id: 0,
        customer_id: params.customerId,
        kind: params.kind,
        title: params.title,
        body: params.body,
        channel: 'mock',
        status: 'mock',
        created_at: new Date().toISOString(),
      };
    },
    list() {
      return [];
    },
  };
}
