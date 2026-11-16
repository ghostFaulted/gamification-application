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
    const rawToken = cookies?.[AUTH_COOKIE_NAME];
    const token = typeof rawToken === 'string' ? rawToken : undefined;

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      req.user = await this.tokenService.verifyAccessToken(token);
      return true;
    } catch (error) {
      res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
      throw error;
    }
  }
}
