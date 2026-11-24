import type { INestApplication } from '@nestjs/common';
import type { Role } from '@gamification/shared';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME } from '../src/auth/auth.constants';
import { RevokedTokensRepository } from '../src/auth/revoked-tokens.repository';
import { TokenService } from '../src/auth/token.service';
import { type BulkInsertStudentsResult, UsersRepository } from '../src/db';
import { MAX_CSV_SIZE_BYTES } from '../src/users/csv-parser.service';
import { setupApp } from '../src/setup-app';

// Both repositories are replaced with in-memory fakes, so no PostgreSQL is needed.
class NoRevokedTokensRepository extends RevokedTokensRepository {
  async revoke(): Promise<void> {}

  async isRevoked(): Promise<boolean> {
    return false;
  }
}

class FakeUsersRepository extends UsersRepository {
  insertedLogins: string[] = [];

  async findByLogin(): Promise<null> {
    return null;
  }

  async findById(): Promise<null> {
    return null;
  }

  /** Logins already "in the database". */
  existingLogins = new Set<string>();

  async bulkInsertStudents(rawLogins: readonly string[]): Promise<BulkInsertStudentsResult> {
    this.insertedLogins = [...rawLogins];
    const createdLogins: string[] = [];
    const skippedLogins: string[] = [];
    for (const login of rawLogins) {
      if (this.existingLogins.has(login)) {
        skippedLogins.push(login);
      } else {
        this.existingLogins.add(login);
        createdLogins.push(login);
      }
    }
    return {
      createdCount: createdLogins.length,
      skippedDuplicatesCount: skippedLogins.length,
      createdLogins,
      skippedLogins,
    };
  }
}

describe('POST /api/users/import', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let usersRepository: FakeUsersRepository;

  function authCookie(role: Role): string {
    const token = tokenService.signAccessToken({ userId: 'test-user', login: `${role}1`, role });
    return `${AUTH_COOKIE_NAME}=${token}`;
  }

  function importAs(role: Role) {
    return request(app.getHttpServer()).post('/api/users/import').set('Cookie', authCookie(role));
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RevokedTokensRepository)
      .useClass(NoRevokedTokensRepository)
      .overrideProvider(UsersRepository)
      .useClass(FakeUsersRepository)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    tokenService = moduleRef.get(TokenService);
    usersRepository = moduleRef.get(UsersRepository);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 401 without an auth cookie', async () => {
    await request(app.getHttpServer()).post('/api/users/import').expect(401);
  });

  it('returns 403 for a student', async () => {
    await importAs('student').attach('file', Buffer.from('login\ns1\n'), 'users.csv').expect(403);
  });

  it('returns 400 when no file is sent', async () => {
    const res = await importAs('lecturer').expect(400);

    expect(res.body.message).toBe('CSV file is required');
  });

  it('returns 400 for a file that is not CSV', async () => {
    const res = await importAs('lecturer')
      .attach('file', Buffer.from('login\ns1\n'), 'users.txt')
      .expect(400);

    expect(res.body.message).toContain('Only .csv files are allowed');
  });

  it('returns 400 for a CSV without a "login" column', async () => {
    const res = await importAs('admin')
      .attach('file', Buffer.from('user\ns1\n'), 'users.csv')
      .expect(400);

    expect(res.body.message).toContain('"login"');
  });

  it('returns 413 for a file over the size limit', async () => {
    await importAs('admin')
      .attach('file', Buffer.alloc(MAX_CSV_SIZE_BYTES + 1, 'a'), 'users.csv')
      .expect(413);
  });

  it('returns 400 for a non-file multipart field', async () => {
    usersRepository.insertedLogins = [];
    const res = await importAs('admin')
      .field('note', 'extra')
      .attach('file', Buffer.from('login\ns1\n'), 'users.csv')
      .expect(400);

    expect(res.body.message).toBe('Too many fields');
    expect(usersRepository.insertedLogins).toEqual([]);
  });

  it('returns 400 for a CSV value with a line break', async () => {
    const res = await importAs('admin')
      .attach('file', Buffer.from('login\n"bad\nlogin"\ns1\n'), 'users.csv')
      .expect(400);

    expect(res.body.message).toBe('CSV values must not contain line breaks');
  });

  it('imports valid logins and reports invalid rows', async () => {
    const res = await importAs('lecturer')
      .attach('file', Buffer.from('login;name\ns1;Jan\nS1;Jan\nbad login;Anna\n'), 'users.csv')
      .expect(200);

    expect(usersRepository.insertedLogins).toEqual(['s1', 's1']);
    expect(res.body).toEqual({
      created: 1,
      skippedDuplicates: 1,
      createdLogins: ['s1'],
      skippedLogins: ['s1'],
      invalid: 1,
      errors: [{ row: 4, value: 'bad login', reason: 'Login contains invalid characters' }],
    });
  });

  it('lists logins skipped because they are already in the database or repeated in the file', async () => {
    usersRepository.existingLogins = new Set(['s2']);

    const res = await importAs('admin')
      .attach('file', Buffer.from('login\ns1\ns2\nS1\ns3\n'), 'users.csv')
      .expect(200);

    expect(res.body).toEqual({
      created: 2,
      skippedDuplicates: 2,
      createdLogins: ['s1', 's3'],
      skippedLogins: ['s2', 's1'],
      invalid: 0,
      errors: [],
    });
  });
});
