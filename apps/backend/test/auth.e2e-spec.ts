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
import { setupApp } from '../src/setup-app';

class InMemoryRevokedTokensRepository extends RevokedTokensRepository {
  private readonly revoked = new Map<string, Date>();
  shouldFailRevoke = false;
  shouldFailIsRevoked = false;

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    if (this.shouldFailRevoke) {
      throw new Error('Database unavailable');
    }
    this.revoked.set(jti, expiresAt);
  }

  async isRevoked(jti: string): Promise<boolean> {
    if (this.shouldFailIsRevoked) {
      throw new Error('Database unavailable');
    }
    return this.revoked.has(jti);
  }
}

@Controller('test-auth')
class TestProtectedController {
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtected() {
    return { access: 'granted' };
  }
}

describe('Auth logout and token expiration (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let repository: InMemoryRevokedTokensRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [TestProtectedController],
    })
      .overrideProvider(RevokedTokensRepository)
      .useClass(InMemoryRevokedTokensRepository)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    tokenService = moduleRef.get(TokenService);
    repository = moduleRef.get(RevokedTokensRepository);
  });

  afterEach(() => {
    repository.shouldFailRevoke = false;
    repository.shouldFailIsRevoked = false;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects requests without auth cookie with 401 and does not set clearCookie', async () => {
    const res = await request(app.getHttpServer()).get('/api/test-auth/protected').expect(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects empty or non-string auth cookie with 401 and clears it', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test-auth/protected')
      .set('Cookie', `${AUTH_COOKIE_NAME}=j:{"bad":true}`)
      .expect(401);

    expect(String(res.headers['set-cookie'])).toContain(`${AUTH_COOKIE_NAME}=;`);
  });

  it('allows access with valid token and revokes it on POST /api/auth/logout', async () => {
    const token = tokenService.signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      login: 's123456',
      role: 'student',
    });
    const cookieHeader = `${AUTH_COOKIE_NAME}=${token}`;

    await request(app.getHttpServer())
      .get('/api/test-auth/protected')
      .set('Cookie', cookieHeader)
      .expect(200, { access: 'granted' });

    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader)
      .expect(200, { ok: true });

    expect(String(logoutRes.headers['set-cookie'])).toContain(`${AUTH_COOKIE_NAME}=;`);

    await request(app.getHttpServer())
      .get('/api/test-auth/protected')
      .set('Cookie', cookieHeader)
      .expect(401);
  });

  it('preserves cookie when revocation lookup fails due to infrastructure error', async () => {
    const token = tokenService.signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      login: 's123456',
      role: 'student',
    });

    repository.shouldFailIsRevoked = true;
    const res = await request(app.getHttpServer())
      .get('/api/test-auth/protected')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`)
      .expect(500);

    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('propagates 500 when revocation persistence fails during logout', async () => {
    const token = tokenService.signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      login: 's123456',
      role: 'student',
    });

    repository.shouldFailRevoke = true;
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`)
      .expect(500);

    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects expired JWT and clears cookie', async () => {
    const expiredToken = jwt.sign({ login: 's123456', role: 'student' }, getJwtSecret(), {
      subject: '11111111-1111-1111-1111-111111111111',
      jwtid: '22222222-2222-2222-2222-222222222222',
      expiresIn: -10,
    });

    const res = await request(app.getHttpServer())
      .get('/api/test-auth/protected')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${expiredToken}`)
      .expect(401);

    expect(String(res.headers['set-cookie'])).toContain(`${AUTH_COOKIE_NAME}=;`);
  });

  it('returns 200 on POST /api/auth/logout even without a cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(200, { ok: true });
    expect(String(res.headers['set-cookie'])).toContain(`${AUTH_COOKIE_NAME}=;`);
  });

  it('fails AuthModule startup in production when JWT_SECRET is missing', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    try {
      const modRef = await Test.createTestingModule({
        imports: [AuthModule],
      })
        .overrideProvider(RevokedTokensRepository)
        .useClass(InMemoryRevokedTokensRepository)
        .compile();

      await expect(modRef.init()).rejects.toThrow(
        'JWT_SECRET environment variable must be set (min 16 chars) in production',
      );
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevSecret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = prevSecret;
      }
    }
  });
});
