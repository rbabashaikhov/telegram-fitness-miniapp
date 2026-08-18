import { describe, expect, it, vi } from 'vitest';
import { createWebhookEventPublisher } from './webhook.js';
import type { EventProvider } from '../types.js';

describe('event webhook adapter', () => {
  it('publishes locally and posts to the webhook URL', async () => {
    const inner: EventProvider = {
      publish(name, payload) {
        return { id: 7, name, payload, created_at: '2026-08-18T09:00:00.000Z' };
      },
      list() {
        return [];
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const publisher = createWebhookEventPublisher(inner, 'https://example.test/events');
    const event = publisher.publish('booking.created', { bookingId: 1 });
    expect(event.id).toBe(7);
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
