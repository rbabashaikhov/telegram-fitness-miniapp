import { describe, expect, it } from 'vitest';
import { isAdminWriteLocked, isDemoAdminPreviewEnabled, publicAppConfig } from './config.js';

describe('publicAppConfig', () => {
  it('does not expose secrets', () => {
    const published = publicAppConfig();
    const json = JSON.stringify(published);
    expect(json).not.toMatch(/ADMIN_TOKEN|adminToken|webhookSecret|telegramBotToken/i);
    expect(published).not.toHaveProperty('admin');
    expect(published).not.toHaveProperty('telegramBotToken');
    expect(published.retention.expiringDays).toBeGreaterThan(0);
    expect(published.retention.lowVisits).toBeGreaterThan(0);
  });
});

describe('admin write lock', () => {
  it('locks writes when token is empty', () => {
    expect(isAdminWriteLocked('')).toBe(true);
    expect(isAdminWriteLocked('secret')).toBe(false);
  });
});

describe('isDemoAdminPreviewEnabled', () => {
  it('requires both browser demo mode and the feature flag', () => {
    expect(
      isDemoAdminPreviewEnabled({
        allowDemoMode: true,
        features: { demoAdminPreview: true },
      }),
    ).toBe(true);
    expect(
      isDemoAdminPreviewEnabled({
        allowDemoMode: false,
        features: { demoAdminPreview: true },
      }),
    ).toBe(false);
  });
});
