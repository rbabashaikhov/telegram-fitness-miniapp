import { describe, expect, it } from 'vitest';
import { AppError } from '../../errors.js';
import { createCrmProviders } from './stub.js';

describe('CRM stub', () => {
  it('fails closed with 501 CRM_NOT_CONFIGURED', () => {
    const providers = createCrmProviders();
    try {
      providers.customers.listAll();
      throw new Error('expected stub to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(501);
      expect((error as AppError).code).toBe('CRM_NOT_CONFIGURED');
    }
  });
});
