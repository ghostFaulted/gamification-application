import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ROLES, type Role } from '@gamification/shared';
import jwt from 'jsonwebtoken';
import { getJwtExpiresInSeconds, getJwtSecret } from './auth.constants';
import { RevokedTokensRepository } from './revoked-tokens.repository';

export interface AuthUserPayload {
  sub: string;
  login: string;
  role: Role;
  jti: string;
  iat: number;
  exp: number;
}

export interface SignTokenInput {
  userId: string;
  login: string;
  role: Role;
}

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

@Injectable()
export class TokenService {
  constructor(private readonly revokedTokens: RevokedTokensRepository) {}

  signAccessToken(input: SignTokenInput): string {
    return jwt.sign(
      {
        login: input.login,
        role: input.role,
      },
      getJwtSecret(),
      {
        subject: input.userId,
        jwtid: randomUUID(),
        expiresIn: getJwtExpiresInSeconds(),
      },
    );
  }

  async verifyAccessToken(token: string): Promise<AuthUserPayload> {
    let decoded: string | jwt.JwtPayload;

    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      throw new UnauthorizedException('Invalid authentication token');
    }

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.login !== 'string' ||
      !isValidRole(decoded.role) ||
      typeof decoded.jti !== 'string' ||
      typeof decoded.iat !== 'number' ||
      typeof decoded.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (await this.revokedTokens.isRevoked(decoded.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      sub: decoded.sub,
      login: decoded.login,
      role: decoded.role,
      jti: decoded.jti,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  }

  async revokeToken(token: string): Promise<void> {
    let decoded: string | jwt.JwtPayload;

    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      // Logout must stay idempotent when the token is already expired or malformed.
      return;
    }

    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.jti === 'string' &&
      typeof decoded.exp === 'number'
    ) {
      await this.revokedTokens.revoke(decoded.jti, new Date(decoded.exp * 1000));
    }
  }
}
