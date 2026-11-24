import { SetMetadata } from '@nestjs/common';
import type { Role } from '@gamification/shared';

export const ROLES_KEY = 'roles';

/**
 * Roles allowed to call a route, checked by RolesGuard. On a method it replaces the roles set
 * on the controller. Prefer `@Auth(...)`, which also applies the guards.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
