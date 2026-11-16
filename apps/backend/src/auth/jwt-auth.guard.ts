import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_COOKIE_NAME, getClearAuthCookieOptions } from './auth.constants';
import { TokenService, type AuthUserPayload } from './token.service';

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();

    const cookies = req.cookies as Record<string, unknown> | undefined;
    const hasAuthCookie = cookies !== undefined && Object.hasOwn(cookies, AUTH_COOKIE_NAME);
    const rawToken = hasAuthCookie ? cookies[AUTH_COOKIE_NAME] : undefined;
    const token = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : undefined;

    if (!token) {
      if (hasAuthCookie) {
        res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
      }
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      req.user = await this.tokenService.verifyAccessToken(token);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
      }
      throw error;
    }
  }
}
