import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  type Type,
} from '@nestjs/common';
import type { Role } from '@gamification/shared';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/**
 * Lets through only users with one of the given roles.
 * Use after JwtAuthGuard, which sets `req.user`: `@UseGuards(JwtAuthGuard, RolesGuard('admin'))`.
 */
export function RolesGuard(...roles: Role[]): Type<CanActivate> {
  @Injectable()
  class RolesGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
      if (user && roles.includes(user.role)) {
        return true;
      }
      throw new ForbiddenException('You do not have permission to perform this action');
    }
  }

  return mixin(RolesGuardMixin);
}
