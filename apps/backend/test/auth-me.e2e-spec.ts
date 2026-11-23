import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME, getJwtSecret } from '../src/auth/auth.constants';
import { RevokedTokensRepository } from '../src/auth/revoked-tokens.repository';
import { TokenService } from '../src/auth/token.service';
import type { User } from '../src/db/schema';
import { UsersRepository, type BulkInsertStudentsResult } from '../src/db/users.repository';
import { setupApp } from '../src/setup-app';

const STUDENT_ID = '11111111-1111-1111-1111-111111111111';

class InMemoryRevokedTokensRepository extends RevokedTokensRepository {
  private readonly revoked = new Set<string>();

  async revoke(jti: string): Promise<void> {
    this.revoked.add(jti);
  }

  async isRevoked(jti: string): Promise<boolean> {
    return this.revoked.has(jti);
  }
}

class InMemoryUsersRepository extends UsersRepository {
  readonly users = new Map<string, User>();

  reset(): void {
    this.users.clear();
    this.users.set(STUDENT_ID, {
      id: STUDENT_ID,
      login: 'student1',
      role: 'student',
      createdAt: new Date(),
    });
  }

  async findByLogin(login: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.login === login) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async bulkInsertStudents(): Promise<BulkInsertStudentsResult> {
    throw new Error('Not used in these tests');
  }
}

function clearsAuthCookie(setCookie: string[] | string | undefined): boolean {
  return String(setCookie).includes(`${AUTH_COOKIE_NAME}=;`);
}

describe('GET /api/auth/me (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let users: InMemoryUsersRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UsersRepository)
      .useClass(InMemoryUsersRepository)
      .overrideProvider(RevokedTokensRepository)
      .useClass(InMemoryRevokedTokensRepository)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    tokenService = moduleRef.get(TokenService);
    users = moduleRef.get(UsersRepository) as InMemoryUsersRepository;
  });

  beforeEach(() => {
    users.reset();
  });

  afterAll(async () => {
    await app?.close();
  });

  function studentCookie(): string {
    const token = tokenService.signAccessToken({
      userId: STUDENT_ID,
      login: 'student1',
      role: 'student',
    });
    return `${AUTH_COOKIE_NAME}=${token}`;
  }

  function me(cookie?: string) {
    const req = request(app.getHttpServer()).get('/api/auth/me');
    return cookie ? req.set('Cookie', cookie) : req;
  }

  it('returns the current user for a valid session', async () => {
    const res = await me(studentCookie()).expect(200);

    expect(res.body).toEqual({ user: { login: 'student1', role: 'student' } });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('returns the role from the database, not from the token', async () => {
    const cookie = studentCookie();
    users.users.set(STUDENT_ID, { ...users.users.get(STUDENT_ID)!, role: 'lecturer' });

    const res = await me(cookie).expect(200);

    expect(res.body).toEqual({ user: { login: 'student1', role: 'lecturer' } });
  });

  it('returns 401 and clears the cookie when the account no longer exists', async () => {
    const cookie = studentCookie();
    users.users.delete(STUDENT_ID);

    const res = await me(cookie).expect(401);

    expect(clearsAuthCookie(res.headers['set-cookie'])).toBe(true);
  });

  it('returns 401 without a cookie', async () => {
    const res = await me().expect(401);

    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('returns 401 and clears the cookie for a malformed token', async () => {
    const res = await me(`${AUTH_COOKIE_NAME}=not-a-jwt`).expect(401);

    expect(clearsAuthCookie(res.headers['set-cookie'])).toBe(true);
  });

  it('returns 401 for an expired token', async () => {
    const expired = jwt.sign({ login: 'student1', role: 'student' }, getJwtSecret(), {
      subject: STUDENT_ID,
      jwtid: '22222222-2222-2222-2222-222222222222',
      expiresIn: -10,
    });

    const res = await me(`${AUTH_COOKIE_NAME}=${expired}`).expect(401);

    expect(clearsAuthCookie(res.headers['set-cookie'])).toBe(true);
  });

  it('returns 401 for a token signed with an algorithm other than HS256', async () => {
    const forged = jwt.sign({ login: 'student1', role: 'admin' }, getJwtSecret(), {
      algorithm: 'HS512',
      subject: STUDENT_ID,
      jwtid: '33333333-3333-3333-3333-333333333333',
      expiresIn: 60,
    });

    await me(`${AUTH_COOKIE_NAME}=${forged}`).expect(401);
  });

  it('returns 401 for a valid signature with a non-uuid subject', async () => {
    const token = jwt.sign({ login: 'student1', role: 'student' }, getJwtSecret(), {
      algorithm: 'HS256',
      subject: 'not-a-uuid',
      jwtid: '44444444-4444-4444-4444-444444444444',
      expiresIn: 60,
    });

    await me(`${AUTH_COOKIE_NAME}=${token}`).expect(401);
  });

  it('returns 401 after logout', async () => {
    const cookie = studentCookie();
    await me(cookie).expect(200);

    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(200);

    await me(cookie).expect(401);
  });
});
