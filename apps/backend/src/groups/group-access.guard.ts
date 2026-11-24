import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { GroupsService } from './groups.service';
import { parseUuid } from './groups.validation';

/**
 * Lets through only the owner of the group from the `:id` route param, or an admin.
 * Guards run before interceptors, so an upload to a foreign or missing group is rejected
 * (400 / 403 / 404) before multer reads it. Must run after JwtAuthGuard.
 */
@Injectable()
export class GroupAccessGuard implements CanActivate {
  constructor(private readonly groupsService: GroupsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }
    const groupId = parseUuid(req.params.id, 'id');
    await this.groupsService.assertGroupAccess(req.user, groupId);
    return true;
  }
}
