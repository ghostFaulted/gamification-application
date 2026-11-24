import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@gamification/shared';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { ROLES_KEY } from './roles.decorator';

const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action';

/**
 * Lets through only users with one of the roles from `@Roles(...)`.
 * Must run after JwtAuthGuard, which sets `req.user`; `@Auth(...)` applies both in order.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Fail closed: a forgotten or empty @Roles must not open the route to every user.
    if (!roles || roles.length === 0) {
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name} uses RolesGuard without @Roles`,
      );
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user && roles.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException(FORBIDDEN_MESSAGE);
  }
}
