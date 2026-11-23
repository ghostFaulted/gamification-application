import { Controller, Get, type INestApplication, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME, getJwtSecret } from '../src/auth/auth.constants';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RevokedTokensRepository } from '../src/auth/revoked-tokens.repository';
import { TokenService } from '../src/auth/token.service';
import type { User } from '../src/db/schema';
import { UsersRepository, type BulkInsertStudentsResult } from '../src/db/users.repository';
import { LdapInvalidCredentialsError, LdapUnavailableError } from '../src/ldap/ldap.errors';
import { LdapService, type LdapUser } from '../src/ldap/ldap.service';
import { setupApp } from '../src/setup-app';

const VALID_PASSWORD = 'correct password ';

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
  readonly users = new Map<string, User>([
    [
      'student1',
      {
        id: '11111111-1111-1111-1111-111111111111',
        login: 'student1',
        role: 'student',
        createdAt: new Date(),
      },
    ],
    [
      'lecturer1',
      {
        id: '22222222-2222-2222-2222-222222222222',
        login: 'lecturer1',
        role: 'lecturer',
        createdAt: new Date(),
      },
    ],
  ]);

  async findByLogin(login: string): Promise<User | null> {
    return this.users.get(login) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.id === id) ?? null;
  }

  async bulkInsertStudents(): Promise<BulkInsertStudentsResult> {
    throw new Error('Not used in these tests');
  }
}

class FakeLdapService {
  unavailable = false;
  readonly calls: Array<{ login: unknown; password: unknown }> = [];

  async authenticate(login: unknown, password: unknown): Promise<LdapUser> {
    this.calls.push({ login, password });
    if (this.unavailable) {
      throw new LdapUnavailableError();
    }
    if (typeof login !== 'string' || password !== VALID_PASSWORD) {
      throw new LdapInvalidCredentialsError();
    }
    const normalized = login.trim().toLowerCase();
    return { login: normalized, dn: `cn=${normalized},dc=test`, email: null };
  }
}

@Controller('test-login')
class TestProtectedController {
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtected() {
    return { access: 'granted' };
  }
}

function extractAuthCookie(setCookie: string[] | string | undefined): string | undefined {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return cookies.find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`));
}

function tokenFrom(cookie: string): string {
  return cookie.split(';')[0].slice(AUTH_COOKIE_NAME.length + 1);
}

describe('POST /api/auth/login (e2e)', () => {
  let app: INestApplication;
  let ldap: FakeLdapService;
  let tokenService: TokenService;

  beforeAll(async () => {
    ldap = new FakeLdapService();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [TestProtectedController],
    })
      .overrideProvider(LdapService)
      .useValue(ldap)
      .overrideProvider(UsersRepository)
      .useClass(InMemoryUsersRepository)
      .overrideProvider(RevokedTokensRepository)
      .useClass(InMemoryRevokedTokensRepository)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    tokenService = moduleRef.get(TokenService);
  });

  afterEach(() => {
    ldap.unavailable = false;
    ldap.calls.length = 0;
  });

  afterAll(async () => {
    await app?.close();
  });

  function login(body: unknown) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send(body as object);
  }

  it('signs in and sets the JWT only in an httpOnly cookie', async () => {
    const res = await login({ login: 'Student1', password: VALID_PASSWORD }).expect(200);

    expect(res.body).toEqual({ user: { login: 'student1', role: 'student' } });
    expect(res.headers['cache-control']).toBe('no-store');

    const cookie = extractAuthCookie(res.headers['set-cookie']);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).toMatch(/; Max-Age=\d+/);

    const token = tokenFrom(cookie!);
    expect(JSON.stringify(res.body)).not.toContain(token);

    const payload = await tokenService.verifyAccessToken(token);
    expect(payload).toEqual(
      expect.objectContaining({
        sub: '11111111-1111-1111-1111-111111111111',
        login: 'student1',
        role: 'student',
      }),
    );
  });

  it('takes the role from the database', async () => {
    const res = await login({ login: 'lecturer1', password: VALID_PASSWORD }).expect(200);

    expect(res.body).toEqual({ user: { login: 'lecturer1', role: 'lecturer' } });
  });

  it('passes the password to LDAP unchanged', async () => {
    await login({ login: 'student1', password: VALID_PASSWORD }).expect(200);

    expect(ldap.calls).toEqual([{ login: 'student1', password: VALID_PASSWORD }]);
  });

  it('issues a cookie accepted by JwtAuthGuard', async () => {
    const res = await login({ login: 'student1', password: VALID_PASSWORD }).expect(200);
    const cookie = extractAuthCookie(res.headers['set-cookie'])!;

    await request(app.getHttpServer())
      .get('/api/test-login/protected')
      .set('Cookie', cookie.split(';')[0])
      .expect(200, { access: 'granted' });
  });

  it('returns 401 for invalid credentials without setting a cookie', async () => {
    const res = await login({ login: 'student1', password: 'wrong' }).expect(401);

    expect(res.body.message).toBe('Invalid login or password');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('returns 503 when LDAP is unavailable', async () => {
    ldap.unavailable = true;

    const res = await login({ login: 'student1', password: VALID_PASSWORD }).expect(503);

    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('answers an unregistered LDAP account exactly like a wrong password', async () => {
    const unregistered = await login({ login: 'student2', password: VALID_PASSWORD }).expect(401);
    const wrongPassword = await login({ login: 'student1', password: 'wrong' }).expect(401);

    expect(unregistered.body).toEqual(wrongPassword.body);
    expect(unregistered.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a token signed with an algorithm other than HS256', async () => {
    const forged = jwt.sign({ login: 'student1', role: 'admin' }, getJwtSecret(), {
      algorithm: 'HS512',
      subject: '11111111-1111-1111-1111-111111111111',
      jwtid: '33333333-3333-3333-3333-333333333333',
      expiresIn: 60,
    });

    await request(app.getHttpServer())
      .get('/api/test-login/protected')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${forged}`)
      .expect(401);
  });

  it.each([
    ['missing password', { login: 'student1' }],
    ['missing login', { password: VALID_PASSWORD }],
    ['non-string login', { login: ['student1'], password: VALID_PASSWORD }],
    ['non-string password', { login: 'student1', password: 12345 }],
  ])('returns 400 for %s', async (_case, body) => {
    await login(body).expect(400);
    expect(ldap.calls).toHaveLength(0);
  });

  it('returns 400 for malformed JSON', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"login": "student1",')
      .expect(400);
  });

  it.each([
    ['form submission', 'application/x-www-form-urlencoded', 'login=student1&password=x'],
    ['plain text', 'text/plain', '{"login":"student1","password":"x"}'],
  ])('returns 415 for %s', async (_case, contentType, body) => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Content-Type', contentType)
      .send(body)
      .expect(415);
    expect(ldap.calls).toHaveLength(0);
  });

  it('revokes the previous session token on a new login', async () => {
    const first = await login({ login: 'student1', password: VALID_PASSWORD }).expect(200);
    const firstCookie = extractAuthCookie(first.headers['set-cookie'])!.split(';')[0];

    const second = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', firstCookie)
      .send({ login: 'student1', password: VALID_PASSWORD })
      .expect(200);
    const secondCookie = extractAuthCookie(second.headers['set-cookie'])!.split(';')[0];

    await request(app.getHttpServer())
      .get('/api/test-login/protected')
      .set('Cookie', firstCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/test-login/protected')
      .set('Cookie', secondCookie)
      .expect(200);
  });

  it('keeps the existing session when a new login attempt fails', async () => {
    const first = await login({ login: 'student1', password: VALID_PASSWORD }).expect(200);
    const firstCookie = extractAuthCookie(first.headers['set-cookie'])!.split(';')[0];

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('Cookie', firstCookie)
      .send({ login: 'student1', password: 'wrong' })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/test-login/protected')
      .set('Cookie', firstCookie)
      .expect(200);
  });
});
