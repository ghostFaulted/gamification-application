import { Injectable, Logger } from '@nestjs/common';
import {
  Client,
  EqualityFilter,
  InvalidCredentialsError,
  SizeLimitExceededError,
  type Entry,
} from 'ldapts';
import { loadLdapConfig, type LdapConfig } from './ldap.config';
import { LdapInvalidCredentialsError, LdapUnavailableError } from './ldap.errors';

export const MAX_LOGIN_LENGTH = 64;
export const MAX_PASSWORD_BYTES = 256;
export interface LdapUser {
  login: string;
  dn: string;
  email: string | null;
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

function normalizeLogin(rawLogin: unknown): string | null {
  if (typeof rawLogin !== 'string') {
    return null;
  }
  const login = rawLogin.trim().toLowerCase();
  if (login.length === 0 || login.length > MAX_LOGIN_LENGTH || hasControlChars(login)) {
    return null;
  }
  return login;
}

function isAcceptablePassword(password: unknown): password is string {
  // An empty password turns a simple bind into an unauthenticated bind, which LDAP reports as success.
  return (
    typeof password === 'string' &&
    password.length > 0 &&
    Buffer.byteLength(password, 'utf8') <= MAX_PASSWORD_BYTES
  );
}

function firstString(value: Entry[string] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.length > 0 ? first : null;
}

@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);
  private config: LdapConfig | null = null;

  async authenticate(rawLogin: unknown, password: unknown): Promise<LdapUser> {
    const login = normalizeLogin(rawLogin);
    if (login === null || !isAcceptablePassword(password)) {
      throw new LdapInvalidCredentialsError();
    }

    const config = this.getConfig();
    const client = new Client({
      url: config.url,
      timeout: config.timeoutMs,
      connectTimeout: config.timeoutMs,
      tlsOptions: config.tlsOptions,
      strictDN: true,
    });

    try {
      const entry = await this.findUserEntry(client, config, login);
      await this.verifyPassword(client, entry.dn, password);

      return {
        login,
        dn: entry.dn,
        email: firstString(entry.mail),
      };
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  private getConfig(): LdapConfig {
    if (this.config === null) {
      try {
        this.config = loadLdapConfig();
      } catch (error) {
        this.logger.error(`LDAP is misconfigured: ${(error as Error).message}`);
        throw new LdapUnavailableError({ cause: error });
      }
    }
    return this.config;
  }

  private async findUserEntry(client: Client, config: LdapConfig, login: string): Promise<Entry> {
    let entries: Entry[];

    try {
      await client.bind(config.bindDn, config.bindPassword);
      const result = await client.search(config.baseDn, {
        scope: 'sub',
        filter: new EqualityFilter({ attribute: config.loginAttribute, value: login }),
        derefAliases: 'never',
        sizeLimit: 2,
        timeLimit: Math.max(1, Math.ceil(config.timeoutMs / 1000)),
        attributes: [config.loginAttribute, 'mail'],
      });
      entries = result.searchEntries;
    } catch (error) {
      if (!(error instanceof SizeLimitExceededError)) {
        this.logger.warn(`LDAP lookup failed: ${(error as Error).name}`);
        throw new LdapUnavailableError({ cause: error });
      }
      entries = [];
      this.logger.warn(`LDAP search for login "${login}" matched more than one entry`);
    }

    if (entries.length > 1) {
      this.logger.warn(`LDAP search for login "${login}" matched more than one entry`);
    }
    if (entries.length !== 1) {
      throw new LdapInvalidCredentialsError();
    }

    return entries[0];
  }

  private async verifyPassword(client: Client, dn: string, password: string): Promise<void> {
    try {
      await client.bind(dn, password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new LdapInvalidCredentialsError();
      }
      this.logger.warn(`LDAP user bind failed: ${(error as Error).name}`);
      throw new LdapUnavailableError({ cause: error });
    }
  }
}
