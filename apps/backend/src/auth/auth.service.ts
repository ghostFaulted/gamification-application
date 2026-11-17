import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '@gamification/shared';
import { UsersRepository } from '../db/users.repository';
import { LdapInvalidCredentialsError, LdapUnavailableError } from '../ldap/ldap.errors';
import { LdapService, type LdapUser } from '../ldap/ldap.service';
import { TokenService } from './token.service';

export interface LoginResult {
  token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly ldap: LdapService,
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
  ) {}

  async login(login: string, password: string): Promise<LoginResult> {
    const ldapUser = await this.authenticateWithLdap(login, password);

    // Only accounts already registered in the app (CSV import or admin) may sign in.
    const user = await this.users.findByLogin(ldapUser.login);
    if (!user) {
      throw new ForbiddenException('Account is not registered in the application');
    }

    const token = this.tokens.signAccessToken({
      userId: user.id,
      login: user.login,
      role: user.role,
    });

    return { token, user: { login: user.login, role: user.role } };
  }

  private async authenticateWithLdap(login: string, password: string): Promise<LdapUser> {
    try {
      return await this.ldap.authenticate(login, password);
    } catch (error) {
      if (error instanceof LdapInvalidCredentialsError) {
        throw new UnauthorizedException('Invalid login or password');
      }
      if (error instanceof LdapUnavailableError) {
        throw new ServiceUnavailableException('Authentication service is unavailable');
      }
      throw error;
    }
  }
}
