import type { PaymentProvider } from '../types.js';

export function createMockPaymentProvider(): PaymentProvider {
  return {
    createIntent(params) {
      return { id: `mock-pay-${params.planId}-${params.customerId}`, status: 'mock' };
    },
  };
}
