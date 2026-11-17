import {
  Injectable,
  Logger,
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

const INVALID_CREDENTIALS_MESSAGE = 'Invalid login or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly ldap: LdapService,
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
  ) {}

  async login(login: string, password: string): Promise<LoginResult> {
    const ldapUser = await this.authenticateWithLdap(login, password);

    // Only accounts already registered in the app (CSV import or admin) may sign in.
    // Same response as a wrong password: anything else would confirm valid LABS credentials.
    const user = await this.users.findByLogin(ldapUser.login);
    if (!user) {
      this.logger.warn(
        `LDAP login "${ldapUser.login}" succeeded but the account is not registered`,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
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
        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
      }
      if (error instanceof LdapUnavailableError) {
        throw new ServiceUnavailableException('Authentication service is unavailable');
      }
      throw error;
    }
  }
}
