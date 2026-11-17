import { Logger } from '@nestjs/common';
import { db } from '../db';
import { DrizzleRevokedTokensRepository } from './revoked-tokens.repository';

jest.mock('../db', () => ({
  db: { insert: jest.fn(), delete: jest.fn() },
  revokedTokens: { jti: 'jti', expiresAt: 'expires_at' },
}));

const dbMock = jest.mocked(db);

function mockInsert(result: Promise<unknown>) {
  const onConflictDoNothing = jest.fn(() => result);
  const values = jest.fn(() => ({ onConflictDoNothing }));
  dbMock.insert.mockReturnValue({ values } as never);
  return { values, onConflictDoNothing };
}

function mockDelete(result: Promise<unknown>) {
  const where = jest.fn(() => result);
  dbMock.delete.mockReturnValue({ where } as never);
  return { where };
}

describe('DrizzleRevokedTokensRepository.revoke', () => {
  const expiresAt = new Date('2030-01-01T00:00:00Z');
  let repository: DrizzleRevokedTokensRepository;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  afterAll(() => {
    Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DrizzleRevokedTokensRepository();
  });

  it('stores the revoked token and prunes expired records', async () => {
    const { values } = mockInsert(Promise.resolve());
    const { where } = mockDelete(Promise.resolve());

    await repository.revoke('jti-1', expiresAt);

    expect(values).toHaveBeenCalledWith({ jti: 'jti-1', expiresAt });
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('does not fail when pruning expired records fails', async () => {
    mockInsert(Promise.resolve());
    mockDelete(Promise.reject(new Error('connection reset')));

    await expect(repository.revoke('jti-1', expiresAt)).resolves.toBeUndefined();
  });

  it('fails when the revocation itself cannot be stored', async () => {
    mockInsert(Promise.reject(new Error('Database unavailable')));
    mockDelete(Promise.resolve());

    await expect(repository.revoke('jti-1', expiresAt)).rejects.toThrow('Database unavailable');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });
});
