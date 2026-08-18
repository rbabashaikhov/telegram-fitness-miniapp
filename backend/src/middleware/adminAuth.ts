import { timingSafeEqual, createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config, isDemoAdminPreviewEnabled } from '../config.js';

function tokensEqual(provided: string, expected: string): boolean {
  const left = createHash('sha256').update(provided).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

export function authorizeAdminWrite(params: {
  expectedToken: string;
  providedToken?: string;
}): boolean {
  if (!params.expectedToken || !params.providedToken) {
    return false;
  }
  return tokensEqual(params.providedToken, params.expectedToken);
}

export function authorizeAdminRead(params: {
  expectedToken: string;
  isProduction: boolean;
  providedToken?: string;
}): boolean {
  if (!params.isProduction && params.expectedToken.length === 0) {
    return true;
  }
  return authorizeAdminWrite(params);
}

function readProvidedToken(req: Request): string | undefined {
  return (
    (req.header('x-admin-token') as string | undefined) ||
    (req.header('authorization')?.replace(/^Bearer\s+/i, '') as string | undefined) ||
    (typeof req.query.adminToken === 'string' ? req.query.adminToken : undefined)
  );
}

export function adminReadMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowed = authorizeAdminRead({
    expectedToken: config.admin.token,
    isProduction: config.isProduction,
    providedToken: readProvidedToken(req),
  });
  if (!allowed) {
    res.status(401).json({ error: 'Admin authentication required', code: 'ADMIN_UNAUTHORIZED' });
    return;
  }
  next();
}

export function adminWriteMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowed = authorizeAdminWrite({
    expectedToken: config.admin.token,
    providedToken: readProvidedToken(req),
  });
  if (!allowed) {
    res.status(401).json({ error: 'Admin authentication required', code: 'ADMIN_UNAUTHORIZED' });
    return;
  }
  next();
}

export function demoAdminPreviewMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isDemoAdminPreviewEnabled()) {
    res.status(404).json({ error: 'Demo admin is disabled', code: 'NOT_FOUND' });
    return;
  }
  next();
}
