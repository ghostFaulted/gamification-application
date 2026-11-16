import type { CookieOptions } from 'express';

export const AUTH_COOKIE_NAME = 'auth_token';
export const DEFAULT_JWT_EXPIRES_IN_SECONDS = 8 * 60 * 60; // 8 hours

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set (min 16 chars) in production');
  }

  return 'dev-only-jwt-secret-change-me';
}

export function getJwtExpiresInSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN_SECONDS;
  if (!raw) {
    return DEFAULT_JWT_EXPIRES_IN_SECONDS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('JWT_EXPIRES_IN_SECONDS must be a positive integer');
  }

  return parsed;
}

export function getAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: getJwtExpiresInSeconds() * 1000,
  };
}

export function getClearAuthCookieOptions(): CookieOptions {
  // Express 5 ignores maxAge/expires in clearCookie; path and flags must match set options.
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}
