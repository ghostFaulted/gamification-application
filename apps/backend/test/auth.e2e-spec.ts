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

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    this.revoked.set(jti, expiresAt);
  }

  async isRevoked(jti: string): Promise<boolean> {
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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects requests without auth cookie with 401', async () => {
    await request(app.getHttpServer()).get('/api/test-auth/protected').expect(401);
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

    const setCookie = logoutRes.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain(`${AUTH_COOKIE_NAME}=;`);

    await request(app.getHttpServer())
      .get('/api/test-auth/protected')
      .set('Cookie', cookieHeader)
      .expect(401);
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
});
