import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_LDAP_LOGIN_ATTRIBUTE,
  DEFAULT_LDAP_TIMEOUT_MS,
  loadLdapConfig,
} from './ldap.config';
import { LdapConfigError } from './ldap.errors';

const baseEnv: NodeJS.ProcessEnv = {
  LDAP_URL: 'ldaps://ldap.example.test:636',
  LDAP_BASE_DN: 'dc=example,dc=test',
  LDAP_ADMIN_DN: 'cn=reader,dc=example,dc=test',
  LDAP_ADMIN_PASSWORD: 'reader-secret',
};

describe('loadLdapConfig', () => {
  it('accepts ldaps:// with secure TLS defaults', () => {
    const config = loadLdapConfig(baseEnv);

    expect(config.url).toBe('ldaps://ldap.example.test:636');
    expect(config.loginAttribute).toBe(DEFAULT_LDAP_LOGIN_ATTRIBUTE);
    expect(config.timeoutMs).toBe(DEFAULT_LDAP_TIMEOUT_MS);
    expect(config.tlsOptions).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2' });
  });

  it('rejects ldap:// by default', () => {
    expect(() => loadLdapConfig({ ...baseEnv, LDAP_URL: 'ldap://ldap:389' })).toThrow(
      LdapConfigError,
    );
  });

  it('rejects ldap:// even when NODE_ENV is not production', () => {
    expect(() =>
      loadLdapConfig({ ...baseEnv, NODE_ENV: 'development', LDAP_URL: 'ldap://ldap:389' }),
    ).toThrow(LdapConfigError);
  });

  it('allows ldap:// only with explicit LDAP_ALLOW_INSECURE=true', () => {
    expect(() =>
      loadLdapConfig({ ...baseEnv, LDAP_URL: 'ldap://ldap:389', LDAP_ALLOW_INSECURE: 'yes' }),
    ).toThrow(LdapConfigError);

    const config = loadLdapConfig({
      ...baseEnv,
      LDAP_URL: 'ldap://ldap:389',
      LDAP_ALLOW_INSECURE: 'true',
    });
    expect(config.url).toBe('ldap://ldap:389');
  });

  it('keeps certificate verification on when insecure mode is allowed', () => {
    const config = loadLdapConfig({ ...baseEnv, LDAP_ALLOW_INSECURE: 'true' });

    expect(config.tlsOptions.rejectUnauthorized).toBe(true);
  });

  it('rejects schemes other than ldap and ldaps', () => {
    expect(() => loadLdapConfig({ ...baseEnv, LDAP_URL: 'http://ldap.example.test' })).toThrow(
      LdapConfigError,
    );
    expect(() => loadLdapConfig({ ...baseEnv, LDAP_URL: 'not a url' })).toThrow(LdapConfigError);
  });

  it.each(['LDAP_URL', 'LDAP_BASE_DN', 'LDAP_ADMIN_DN', 'LDAP_ADMIN_PASSWORD'])(
    'requires %s',
    (name) => {
      expect(() => loadLdapConfig({ ...baseEnv, [name]: '  ' })).toThrow(LdapConfigError);
    },
  );

  it('validates LDAP_LOGIN_ATTRIBUTE', () => {
    expect(
      loadLdapConfig({ ...baseEnv, LDAP_LOGIN_ATTRIBUTE: 'sAMAccountName' }).loginAttribute,
    ).toBe('sAMAccountName');
    expect(() => loadLdapConfig({ ...baseEnv, LDAP_LOGIN_ATTRIBUTE: 'uid)(cn=*' })).toThrow(
      LdapConfigError,
    );
  });

  it.each(['0', '-1', '1.5', 'abc', '60001'])('rejects LDAP_TIMEOUT_MS=%s', (value) => {
    expect(() => loadLdapConfig({ ...baseEnv, LDAP_TIMEOUT_MS: value })).toThrow(LdapConfigError);
  });

  describe('LDAP_TLS_CA_FILE', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'ldap-ca-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('loads the CA certificate', () => {
      const caFile = join(dir, 'ca.pem');
      writeFileSync(caFile, 'test-ca');

      const config = loadLdapConfig({ ...baseEnv, LDAP_TLS_CA_FILE: caFile });

      expect(config.tlsOptions.ca?.toString()).toBe('test-ca');
      expect(config.tlsOptions.rejectUnauthorized).toBe(true);
    });

    it('fails when the file cannot be read', () => {
      expect(() =>
        loadLdapConfig({ ...baseEnv, LDAP_TLS_CA_FILE: join(dir, 'missing.pem') }),
      ).toThrow(LdapConfigError);
    });
  });
});
