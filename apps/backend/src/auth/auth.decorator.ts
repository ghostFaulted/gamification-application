import { applyDecorators, UseGuards } from '@nestjs/common';
import type { Role } from '@gamification/shared';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

/**
 * Requires a valid session and one of the given roles: 401 without a valid token, 403 for
 * another role. Guards run before interceptors, so an upload is not read for rejected users.
 */
export function Auth(...roles: [Role, ...Role[]]) {
  return applyDecorators(Roles(...roles), UseGuards(JwtAuthGuard, RolesGuard));
}
