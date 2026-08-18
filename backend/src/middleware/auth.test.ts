import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEMO_USER, resolveAuth, validateTelegramInitData } from './auth.js';

function buildInitData(botToken: string, user: object, authDate = Math.floor(Date.now() / 1000)): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'test-query');
  params.set('user', JSON.stringify(user));

  const pairs: string[] = [];
  params.forEach((value, key) => {
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('Telegram initData validation', () => {
  const token = '123456:TEST_BOT_TOKEN';

  it('accepts a valid signed payload', () => {
    const initData = buildInitData(token, {
      id: 42,
      username: 'ivan',
      first_name: 'Ivan',
    });
    const user = validateTelegramInitData(initData, token);
    expect(user.id).toBe(42);
  });

  it('rejects a tampered payload', () => {
    const initData = buildInitData(token, { id: 42, first_name: 'Ivan' });
    const tampered = initData.replace('Ivan', 'Petr');
    expect(() => validateTelegramInitData(tampered, token)).toThrow(/Invalid Telegram initData signature/);
  });

  it('rejects expired initData', () => {
    const initData = buildInitData(token, { id: 42, first_name: 'Ivan' }, 1);
    expect(() => validateTelegramInitData(initData, token, 10)).toThrow(/expired/);
  });
});

describe('browser demo mode', () => {
  it('uses demo user when demo is allowed and initData is missing', () => {
    const auth = resolveAuth(undefined, true, 'token');
    expect(auth.isDemo).toBe(true);
    expect(auth.telegramUser).toEqual(DEMO_USER);
  });

  it('requires Telegram auth when demo is disabled', () => {
    expect(() => resolveAuth(undefined, false, 'token')).toThrow('Telegram authentication required');
  });

  it('returns the signed Telegram user when initData is valid', () => {
    const initData = buildInitData('token', { id: 77, first_name: 'Real' });
    const auth = resolveAuth(initData, false, 'token');
    expect(auth.isDemo).toBe(false);
    expect(auth.telegramUser.id).toBe(77);
  });
});
