import { type ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@gamification/shared';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Roles('lecturer', 'admin')
class StaffController {
  list() {}

  @Roles('admin')
  adminOnly() {}
}

class UndecoratedController {
  open() {}

  @Roles()
  empty() {}
}

function contextFor(
  controller: new () => object,
  handler: (...args: never[]) => unknown,
  role?: Role,
): ExecutionContext {
  const user = role ? { sub: 'id', login: 'user', role, jti: 'jti', iat: 0, exp: 0 } : undefined;
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const staff = StaffController.prototype;
  const undecorated = UndecoratedController.prototype;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each<Role>(['lecturer', 'admin'])('allows %s on a controller-level @Roles', (role) => {
    expect(guard.canActivate(contextFor(StaffController, staff.list, role))).toBe(true);
  });

  it('rejects a role not listed in @Roles with 403', () => {
    expect(() => guard.canActivate(contextFor(StaffController, staff.list, 'student'))).toThrow(
      ForbiddenException,
    );
  });

  it('lets method-level @Roles replace the controller roles', () => {
    expect(guard.canActivate(contextFor(StaffController, staff.adminOnly, 'admin'))).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(StaffController, staff.adminOnly, 'lecturer')),
    ).toThrow(ForbiddenException);
  });

  it('rejects a request without an authenticated user', () => {
    expect(() => guard.canActivate(contextFor(StaffController, staff.list))).toThrow(
      ForbiddenException,
    );
  });

  it.each([
    ['without @Roles', undecorated.open],
    ['with empty @Roles()', undecorated.empty],
  ])('denies every role on a route %s and logs the misconfiguration', (_case, handler) => {
    for (const role of ['student', 'lecturer', 'admin'] as const) {
      expect(() => guard.canActivate(contextFor(UndecoratedController, handler, role))).toThrow(
        ForbiddenException,
      );
    }
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('UndecoratedController'),
    );
  });
});
