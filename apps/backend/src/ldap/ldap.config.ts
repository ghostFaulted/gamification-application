import { readFileSync } from 'node:fs';
import type { ConnectionOptions } from 'node:tls';
import { LdapConfigError } from './ldap.errors';

export const DEFAULT_LDAP_LOGIN_ATTRIBUTE = 'uid';
export const DEFAULT_LDAP_TIMEOUT_MS = 5000;
const MAX_LDAP_TIMEOUT_MS = 60_000;
const ATTRIBUTE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;

export interface LdapConfig {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  loginAttribute: string;
  timeoutMs: number;
  /** Set only for ldaps://; ldapts starts a TLS handshake whenever tlsOptions are present. */
  tlsOptions: ConnectionOptions | undefined;
}

function readRequired(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new LdapConfigError(`${name} environment variable must be set`);
  }
  return value;
}

function readRequiredSecret(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new LdapConfigError(`${name} environment variable must be set`);
  }
  return value;
}

function parseUrl(raw: string, allowInsecure: boolean): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new LdapConfigError('LDAP_URL must be a valid URL', { cause: error });
  }

  if (url.protocol === 'ldaps:') {
    return raw;
  }
  if (url.protocol === 'ldap:' && allowInsecure) {
    return raw;
  }
  if (url.protocol === 'ldap:') {
    throw new LdapConfigError(
      'LDAP_URL must use ldaps://. Plain ldap:// requires LDAP_ALLOW_INSECURE=true (local development only)',
    );
  }
  throw new LdapConfigError('LDAP_URL must use the ldaps:// scheme');
}

function parseTimeout(raw: string | undefined): number {
  if (!raw?.trim()) {
    return DEFAULT_LDAP_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_LDAP_TIMEOUT_MS) {
    throw new LdapConfigError(
      `LDAP_TIMEOUT_MS must be an integer between 1 and ${MAX_LDAP_TIMEOUT_MS}`,
    );
  }
  return parsed;
}

function parseLoginAttribute(raw: string | undefined): string {
  const attribute = raw?.trim() || DEFAULT_LDAP_LOGIN_ATTRIBUTE;
  if (!ATTRIBUTE_NAME_PATTERN.test(attribute)) {
    throw new LdapConfigError('LDAP_LOGIN_ATTRIBUTE must be a plain LDAP attribute name');
  }
  return attribute;
}

function buildTlsOptions(caFile: string | undefined): ConnectionOptions {
  const tlsOptions: ConnectionOptions = {
    // Explicit value also overrides NODE_TLS_REJECT_UNAUTHORIZED=0.
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  };

  const path = caFile?.trim();
  if (path) {
    try {
      tlsOptions.ca = readFileSync(path);
    } catch (error) {
      throw new LdapConfigError(`Cannot read LDAP_TLS_CA_FILE (${path})`, { cause: error });
    }
  }

  return tlsOptions;
}

export function loadLdapConfig(env: NodeJS.ProcessEnv = process.env): LdapConfig {
  const allowInsecure = env.LDAP_ALLOW_INSECURE?.trim().toLowerCase() === 'true';
  const url = parseUrl(readRequired(env, 'LDAP_URL'), allowInsecure);
  const isLdaps = new URL(url).protocol === 'ldaps:';

  return {
    url,
    baseDn: readRequired(env, 'LDAP_BASE_DN'),
    bindDn: readRequired(env, 'LDAP_ADMIN_DN'),
    bindPassword: readRequiredSecret(env, 'LDAP_ADMIN_PASSWORD'),
    loginAttribute: parseLoginAttribute(env.LDAP_LOGIN_ATTRIBUTE),
    timeoutMs: parseTimeout(env.LDAP_TIMEOUT_MS),
    tlsOptions: isLdaps ? buildTlsOptions(env.LDAP_TLS_CA_FILE) : undefined,
  };
}
