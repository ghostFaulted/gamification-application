import { Logger } from '@nestjs/common';
import {
  Client,
  EqualityFilter,
  InvalidCredentialsError,
  SizeLimitExceededError,
  type SearchOptions,
} from 'ldapts';
import { LdapInvalidCredentialsError, LdapUnavailableError } from './ldap.errors';
import { MAX_LOGIN_LENGTH, MAX_PASSWORD_BYTES, LdapService } from './ldap.service';

jest.mock('ldapts', () => {
  const actual = jest.requireActual<typeof import('ldapts')>('ldapts');
  return { ...actual, Client: jest.fn() };
});

const ClientMock = jest.mocked(Client);

const SERVICE_DN = 'cn=reader,dc=example,dc=test';
const SERVICE_PASSWORD = 'reader-secret';
const USER_DN = 'cn=student1,ou=Students,dc=example,dc=test';

const ldapEnv = {
  LDAP_URL: 'ldaps://ldap.example.test:636',
  LDAP_BASE_DN: 'dc=example,dc=test',
  LDAP_ADMIN_DN: SERVICE_DN,
  LDAP_ADMIN_PASSWORD: SERVICE_PASSWORD,
  LDAP_ALLOW_INSECURE: '',
  LDAP_LOGIN_ATTRIBUTE: '',
  LDAP_TIMEOUT_MS: '',
  LDAP_TLS_CA_FILE: '',
};

interface FakeClient {
  bind: jest.Mock<Promise<void>, [string, string]>;
  search: jest.Mock;
  unbind: jest.Mock<Promise<void>, []>;
}

function createFakeClient(): FakeClient {
  const client: FakeClient = {
    bind: jest.fn(async (dn: string, password: string) => {
      if (dn === SERVICE_DN && password === SERVICE_PASSWORD) return;
      if (dn === USER_DN && password === 'correct-password') return;
      throw new InvalidCredentialsError();
    }),
    search: jest.fn(async () => ({
      searchEntries: [{ dn: USER_DN, uid: 'student1', mail: 'student1@example.test' }],
      searchReferences: [],
    })),
    unbind: jest.fn(async () => undefined),
  };
  ClientMock.mockImplementation(() => client as unknown as Client);
  return client;
}

describe('LdapService', () => {
  const originalEnv = process.env;
  let service: LdapService;
  let client: FakeClient;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  afterAll(() => {
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  });

  beforeEach(() => {
    process.env = { ...originalEnv, ...ldapEnv };
    ClientMock.mockReset();
    client = createFakeClient();
    service = new LdapService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('authenticates a user with search-then-bind', async () => {
    await expect(service.authenticate('  Student1 ', 'correct-password')).resolves.toEqual({
      login: 'student1',
      dn: USER_DN,
      email: 'student1@example.test',
    });

    expect(client.bind).toHaveBeenNthCalledWith(1, SERVICE_DN, SERVICE_PASSWORD);
    expect(client.bind).toHaveBeenNthCalledWith(2, USER_DN, 'correct-password');
    expect(client.unbind).toHaveBeenCalledTimes(1);
  });

  it('connects with certificate verification and TLS 1.2+', async () => {
    await service.authenticate('student1', 'correct-password');

    expect(ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'ldaps://ldap.example.test:636',
        tlsOptions: expect.objectContaining({ rejectUnauthorized: true, minVersion: 'TLSv1.2' }),
      }),
    );
  });

  it('does not pass TLS options for explicitly allowed plain ldap://', async () => {
    process.env.LDAP_URL = 'ldap://ldap:389';
    process.env.LDAP_ALLOW_INSECURE = 'true';

    await service.authenticate('student1', 'correct-password');

    const [options] = ClientMock.mock.calls[0];
    expect(options.url).toBe('ldap://ldap:389');
    expect(options.tlsOptions).toBeUndefined();
  });

  it('uses a hardened search with an escaped equality filter', async () => {
    await service.authenticate('student1', 'correct-password');

    const [baseDn, options] = client.search.mock.calls[0] as [string, SearchOptions];
    expect(baseDn).toBe('dc=example,dc=test');
    expect(options).toEqual(
      expect.objectContaining({
        scope: 'sub',
        derefAliases: 'never',
        attributes: ['uid', 'mail'],
      }),
    );
    expect(options.sizeLimit).toBeUndefined();
    expect(options.timeLimit).toBeGreaterThan(0);
    expect(options.filter).toBeInstanceOf(EqualityFilter);
  });

  it('treats filter metacharacters in the login as literal text', async () => {
    client.search.mockResolvedValueOnce({ searchEntries: [], searchReferences: [] });

    await expect(service.authenticate('*)(uid=*', 'correct-password')).rejects.toBeInstanceOf(
      LdapInvalidCredentialsError,
    );

    const filter = (client.search.mock.calls[0] as [string, SearchOptions])[1]
      .filter as EqualityFilter;
    expect(filter.value).toBe('*)(uid=*');
    expect(filter.toString()).toBe('(uid=\\2a\\29\\28uid=\\2a)');
  });

  it('rejects a wrong password', async () => {
    await expect(service.authenticate('student1', 'wrong-password')).rejects.toBeInstanceOf(
      LdapInvalidCredentialsError,
    );
    expect(client.unbind).toHaveBeenCalledTimes(1);
  });

  it('returns the same error for an unknown user as for a wrong password', async () => {
    client.search.mockResolvedValueOnce({ searchEntries: [], searchReferences: [] });

    await expect(service.authenticate('nobody', 'correct-password')).rejects.toBeInstanceOf(
      LdapInvalidCredentialsError,
    );
    expect(client.bind).toHaveBeenCalledTimes(1);
  });

  it('rejects an ambiguous login matching several entries', async () => {
    client.search.mockResolvedValueOnce({
      searchEntries: [{ dn: USER_DN }, { dn: 'cn=other,dc=example,dc=test' }],
      searchReferences: [],
    });

    await expect(service.authenticate('student1', 'correct-password')).rejects.toBeInstanceOf(
      LdapInvalidCredentialsError,
    );
    expect(client.bind).toHaveBeenCalledTimes(1);
  });

  it('rejects an ambiguous login reported by the server size limit', async () => {
    client.search.mockRejectedValueOnce(new SizeLimitExceededError());

    await expect(service.authenticate('student1', 'correct-password')).rejects.toBeInstanceOf(
      LdapInvalidCredentialsError,
    );
  });

  it.each([
    ['empty password', 'student1', ''],
    ['non-string password', 'student1', undefined],
    ['too long password', 'student1', 'x'.repeat(MAX_PASSWORD_BYTES + 1)],
    ['empty login', '   ', 'correct-password'],
    ['too long login', 'a'.repeat(MAX_LOGIN_LENGTH + 1), 'correct-password'],
    ['login with control characters', 'student1\nadmin', 'correct-password'],
    ['login with NUL', 'student1\u0000', 'correct-password'],
  ])('rejects %s without contacting LDAP', async (_case, login, password) => {
    await expect(service.authenticate(login, password)).rejects.toBeInstanceOf(
      LdapInvalidCredentialsError,
    );
    expect(ClientMock).not.toHaveBeenCalled();
  });

  it('reports the server as unavailable when the connection fails', async () => {
    client.bind.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    await expect(service.authenticate('student1', 'correct-password')).rejects.toBeInstanceOf(
      LdapUnavailableError,
    );
    expect(client.unbind).toHaveBeenCalledTimes(1);
  });

  it('reports the server as unavailable when the service account is rejected', async () => {
    client.bind.mockRejectedValueOnce(new InvalidCredentialsError());

    await expect(service.authenticate('student1', 'correct-password')).rejects.toBeInstanceOf(
      LdapUnavailableError,
    );
  });

  it('reports the server as unavailable when the user bind fails for a non-credential reason', async () => {
    client.bind.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('socket hang up'));

    await expect(service.authenticate('student1', 'correct-password')).rejects.toBeInstanceOf(
      LdapUnavailableError,
    );
  });

  it('fails closed on plain ldap:// without LDAP_ALLOW_INSECURE', async () => {
    process.env.LDAP_URL = 'ldap://ldap:389';

    await expect(service.authenticate('student1', 'correct-password')).rejects.toBeInstanceOf(
      LdapUnavailableError,
    );
    expect(ClientMock).not.toHaveBeenCalled();
  });
});
