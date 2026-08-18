import express from 'express';
import http from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it } from 'vitest';
import { adminWriteMiddleware } from './adminAuth.js';
import { authMiddleware } from './auth.js';

function dispatch(
  app: express.Express,
  method: string,
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage(new Socket());
    req.method = method;
    req.url = url;
    req.headers = { host: '127.0.0.1', ...headers };
    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    const originalEnd = res.end.bind(res);
    res.end = ((chunk?: unknown, encoding?: BufferEncoding, cb?: () => void) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding));
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      let json: Record<string, unknown> = {};
      if (raw) {
        try {
          json = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          json = { raw };
        }
      }
      resolve({ status: res.statusCode || 0, json });
      return originalEnd(chunk as never, encoding as never, cb);
    }) as typeof res.end;
    req.on('error', reject);
    app(req, res);
    req.push(null);
  });
}

describe('security gates', () => {
  it('rejects invalid Telegram auth when demo mode is off', async () => {
    const previousDemo = process.env.ALLOW_DEMO_MODE;
    const previousEnv = process.env.NODE_ENV;
    const previousToken = process.env.TELEGRAM_BOT_TOKEN;
    process.env.ALLOW_DEMO_MODE = 'false';
    process.env.NODE_ENV = 'production';
    process.env.TELEGRAM_BOT_TOKEN = '123456:TEST';

    const app = express();
    app.use('/api/me', authMiddleware, (_req, res) => res.json({ ok: true }));
    const response = await dispatch(app, 'GET', '/api/me', {
      'x-telegram-init-data': 'user=%7B%22id%22%3A1%7D&hash=deadbeef',
    });
    expect(response.status).toBe(401);
    expect(response.json.code).toBe('UNAUTHORIZED');

    process.env.ALLOW_DEMO_MODE = previousDemo;
    process.env.NODE_ENV = previousEnv;
    process.env.TELEGRAM_BOT_TOKEN = previousToken;
  });

  it('rejects unauthorized admin writes', async () => {
    const app = express();
    app.use('/api/admin', adminWriteMiddleware, (_req, res) => res.json({ ok: true }));
    const response = await dispatch(app, 'PATCH', '/api/admin/bookings/1');
    expect(response.status).toBe(401);
    expect(response.json.code).toBe('ADMIN_UNAUTHORIZED');
  });
});
