import { describe, expect, it } from 'vitest';
import { AppError } from '../../errors.js';
import { createExternalPaymentProvider } from './external.js';
import { createMockPaymentProvider } from './mock.js';

describe('payment adapters', () => {
  it('mock intent succeeds without acquiring', () => {
    const payments = createMockPaymentProvider();
    expect(payments.createIntent({ customerId: 1, planId: 2, amount: 8900 })).toEqual({
      id: 'mock-pay-2-1',
      status: 'mock',
    });
  });

  it('external adapter fails closed with 501 PAYMENT_NOT_CONFIGURED', () => {
    const payments = createExternalPaymentProvider();
    try {
      payments.createIntent({ customerId: 1, planId: 2, amount: 8900 });
      throw new Error('expected adapter to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(501);
      expect((error as AppError).code).toBe('PAYMENT_NOT_CONFIGURED');
    }
  });
});
