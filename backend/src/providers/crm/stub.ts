import { AppError } from '../../errors.js';
import type { Providers } from '../types.js';

/**
 * CRM-backed providers replace local SQLite at composition time.
 * Application services never branch on DATA_MODE.
 */
export function createCrmProviders(): Providers {
  const notConfigured = (method: string): never => {
    throw new AppError(
      `CRM data mode is not configured. Implement a fitness CRM adapter for ${method}.`,
      501,
      'CRM_NOT_CONFIGURED',
      { method },
    );
  };

  const stub = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        return () => notConfigured(String(prop));
      },
    },
  );

  return {
    club: stub as Providers['club'],
    customers: stub as Providers['customers'],
    trainers: stub as Providers['trainers'],
    activities: stub as Providers['activities'],
    memberships: stub as Providers['memberships'],
    schedule: stub as Providers['schedule'],
    bookings: stub as Providers['bookings'],
    events: stub as Providers['events'],
    notifications: stub as Providers['notifications'],
    transaction<T>(fn: () => T): T {
      return fn();
    },
  };
}
