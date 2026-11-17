import {
  BadRequestException,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { LoginRequest, LoginResponse } from '@gamification/shared';
import type { Request, Response } from 'express';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} from './auth.constants';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

function readAuthCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const rawToken = cookies?.[AUTH_COOKIE_NAME];
  return typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    // HTML forms cannot send JSON cross-site without a CORS preflight, which blocks login CSRF.
    if (!req.is('application/json')) {
      throw new UnsupportedMediaTypeException('Content-Type must be application/json');
    }

    const body = req.body as Partial<Record<keyof LoginRequest, unknown>> | undefined;
    if (typeof body?.login !== 'string' || typeof body.password !== 'string') {
      throw new BadRequestException('login and password must be strings');
    }

    const { token, user } = await this.authService.login(body.login, body.password);

    const previousToken = readAuthCookie(req);
    if (previousToken) {
      await this.tokenService.revokeToken(previousToken);
    }

    res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const rawToken = readAuthCookie(req);

    if (rawToken) {
      await this.tokenService.revokeToken(rawToken);
    }

    res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
    return { ok: true };
  }
}
