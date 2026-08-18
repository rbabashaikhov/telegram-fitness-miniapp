import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthContext, TelegramUser } from '../types.js';

export {};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const DEMO_USER: TelegramUser = {
  id: 999000001,
  username: 'demo_client',
  first_name: 'Александр',
  last_name: 'Волков',
};

function parseInitData(initData: string): URLSearchParams {
  return new URLSearchParams(initData);
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): TelegramUser {
  const params = parseInitData(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new Error('Missing hash in initData');
  }

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      pairs.push(`${key}=${value}`);
    }
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const hashBuffer = Buffer.from(hash, 'hex');
  const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

  if (
    hashBuffer.length !== calculatedBuffer.length ||
    !timingSafeEqual(hashBuffer, calculatedBuffer)
  ) {
    throw new Error('Invalid Telegram initData signature');
  }

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > maxAgeSeconds) {
    throw new Error('Telegram initData expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new Error('Missing user in initData');
  }

  const user = JSON.parse(userRaw) as TelegramUser;
  if (!user?.id) {
    throw new Error('Invalid Telegram user payload');
  }

  return user;
}

export function resolveAuth(
  initDataHeader: string | undefined,
  demoAllowed: boolean,
  botToken: string | undefined,
): AuthContext {
  if (initDataHeader && botToken) {
    try {
      const telegramUser = validateTelegramInitData(initDataHeader, botToken);
      return { telegramUser, isDemo: false };
    } catch (error) {
      if (!demoAllowed) {
        throw error;
      }
    }
  }

  if (initDataHeader && !botToken && demoAllowed) {
    try {
      const params = parseInitData(initDataHeader);
      const userRaw = params.get('user');
      if (userRaw) {
        const user = JSON.parse(userRaw) as TelegramUser;
        if (user?.id) {
          return { telegramUser: user, isDemo: true };
        }
      }
    } catch {
      // fall through
    }
  }

  if (demoAllowed) {
    return { telegramUser: DEMO_USER, isDemo: true };
  }

  throw new Error('Telegram authentication required');
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const demoAllowed =
    process.env.ALLOW_DEMO_MODE === 'true' ||
    process.env.NODE_ENV !== 'production' ||
    !process.env.TELEGRAM_BOT_TOKEN;

  const initData =
    (req.header('x-telegram-init-data') as string | undefined) ||
    (typeof req.query.initData === 'string' ? req.query.initData : undefined);

  try {
    req.auth = resolveAuth(initData, demoAllowed, process.env.TELEGRAM_BOT_TOKEN);
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    res.status(401).json({ error: message, code: 'UNAUTHORIZED' });
  }
}

export { DEMO_USER };
