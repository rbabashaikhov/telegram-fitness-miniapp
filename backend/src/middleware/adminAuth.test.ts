import { describe, expect, it } from 'vitest';
import { authorizeAdminRead, authorizeAdminWrite } from './adminAuth.js';

describe('admin authorization', () => {
  it('rejects writes when ADMIN_TOKEN is not configured', () => {
    expect(
      authorizeAdminWrite({
        expectedToken: '',
        providedToken: undefined,
      }),
    ).toBe(false);
    expect(
      authorizeAdminWrite({
        expectedToken: '',
        providedToken: 'anything',
      }),
    ).toBe(false);
  });

  it('accepts the configured write token', () => {
    expect(
      authorizeAdminWrite({
        expectedToken: 'ops-secret',
        providedToken: 'ops-secret',
      }),
    ).toBe(true);
    expect(
      authorizeAdminWrite({
        expectedToken: 'ops-secret',
        providedToken: 'nope',
      }),
    ).toBe(false);
  });

  it('allows unauthenticated admin reads only outside production when token is empty', () => {
    expect(
      authorizeAdminRead({
        expectedToken: '',
        isProduction: false,
        providedToken: undefined,
      }),
    ).toBe(true);
    expect(
      authorizeAdminRead({
        expectedToken: '',
        isProduction: true,
        providedToken: undefined,
      }),
    ).toBe(false);
  });
});
