import { Controller, Get, type INestApplication, Logger, UseGuards } from '@nestjs/common';
import type { Role } from '@gamification/shared';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME } from '../src/auth/auth.constants';
import { Auth } from '../src/auth/auth.decorator';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RevokedTokensRepository } from '../src/auth/revoked-tokens.repository';
import { RolesGuard } from '../src/auth/roles.guard';
import { TokenService } from '../src/auth/token.service';
import { setupApp } from '../src/setup-app';

class NoRevokedTokensRepository extends RevokedTokensRepository {
  async revoke(): Promise<void> {}

  async isRevoked(): Promise<boolean> {
    return false;
  }
}

@Controller('test-roles')
@Auth('lecturer', 'admin')
class TestRolesController {
  @Get('staff')
  staff() {
    return { access: 'staff' };
  }

  @Get('admin')
  @Auth('admin')
  adminOnly() {
    return { access: 'admin' };
  }
}

@Controller('test-roles-misconfigured')
@UseGuards(JwtAuthGuard, RolesGuard)
class MisconfiguredController {
  @Get()
  open() {
    return { access: 'granted' };
  }
}

describe('@Auth / RolesGuard (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
      controllers: [TestRolesController, MisconfiguredController],
    })
      .overrideProvider(RevokedTokensRepository)
      .useClass(NoRevokedTokensRepository)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    tokenService = moduleRef.get(TokenService);
  });

  afterAll(async () => {
    await app?.close();
  });

  function get(path: string, role?: Role) {
    const req = request(app.getHttpServer()).get(`/api/${path}`);
    if (!role) {
      return req;
    }
    const token = tokenService.signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      login: `${role}1`,
      role,
    });
    return req.set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);
  }

  it('returns 401 without a session', async () => {
    await get('test-roles/staff').expect(401);
  });

  it('returns 403 for a role not allowed on the controller', async () => {
    const res = await get('test-roles/staff', 'student').expect(403);

    expect(res.body.message).toBe('You do not have permission to perform this action');
  });

  it.each<Role>(['lecturer', 'admin'])('allows %s on the controller routes', async (role) => {
    await get('test-roles/staff', role).expect(200, { access: 'staff' });
  });

  it('applies method-level roles instead of the controller roles', async () => {
    await get('test-roles/admin', 'admin').expect(200, { access: 'admin' });
    await get('test-roles/admin', 'lecturer').expect(403);
    await get('test-roles/admin', 'student').expect(403);
  });

  it('denies every role when @Roles is missing', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      for (const role of ['student', 'lecturer', 'admin'] as const) {
        await get('test-roles-misconfigured', role).expect(403);
      }
    } finally {
      logError.mockRestore();
    }
  });
});
