import { Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_COOKIE_NAME, getClearAuthCookieOptions } from './auth.constants';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const rawToken = cookies?.[AUTH_COOKIE_NAME];

    if (typeof rawToken === 'string' && rawToken.length > 0) {
      await this.tokenService.revokeToken(rawToken);
    }

    res.clearCookie(AUTH_COOKIE_NAME, getClearAuthCookieOptions());
    return { ok: true };
  }
}
