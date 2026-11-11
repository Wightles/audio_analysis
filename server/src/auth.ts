import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const sessionCookie = 'rb_session';
const sessions = new Set<string>();
const attempts = new Map<string, { count: number; blockedUntil: number }>();

export const isAuthenticated = (request: Request): boolean => {
  const token = request.signedCookies?.[sessionCookie];
  return typeof token === 'string' && sessions.has(token);
};

export const requireAuth = (request: Request, response: Response, next: NextFunction): void => {
  if (!isAuthenticated(request)) {
    response.status(401).json({ error: 'Требуется авторизация' });
    return;
  }
  next();
};

export const login = (request: Request, response: Response, password: string): void => {
  const ip = request.ip || 'unknown';
  const now = Date.now();
  const record = attempts.get(ip) ?? { count: 0, blockedUntil: 0 };
  if (record.blockedUntil > now) {
    response.status(429).json({ error: 'Слишком много попыток. Повторите позже.' });
    return;
  }

  if (password !== process.env.DEMO_PASSWORD) {
    record.count += 1;
    if (record.count >= 5) {
      record.blockedUntil = now + 15 * 60 * 1000;
      record.count = 0;
    }
    attempts.set(ip, record);
    response.status(401).json({ error: 'Неверный пароль' });
    return;
  }

  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.add(token);
  response.cookie(sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    maxAge: 8 * 60 * 60 * 1000,
  });
  response.json({ authenticated: true });
};

export const logout = (request: Request, response: Response): void => {
  const token = request.signedCookies?.[sessionCookie];
  if (typeof token === 'string') sessions.delete(token);
  response.clearCookie(sessionCookie);
  response.status(204).send();
};
