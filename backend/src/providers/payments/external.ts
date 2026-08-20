import { AppError } from '../../errors.js';
import type { PaymentProvider } from '../types.js';

export function createExternalPaymentProvider(): PaymentProvider {
  return {
    createIntent() {
      throw new AppError(
        'Payment adapter is not configured. Connect a payment provider before charging clients.',
        501,
        'PAYMENT_NOT_CONFIGURED',
      );
    },
  };
}
