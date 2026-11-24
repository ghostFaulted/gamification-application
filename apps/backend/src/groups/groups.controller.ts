import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { GroupDto } from '@gamification/shared';
import { Auth } from '../auth/auth.decorator';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import type { AuthUserPayload } from '../auth/token.service';
import { GroupsService } from './groups.service';
import { parseCreateGroupBody, parseUpdateGroupBody, parseUuid } from './groups.validation';

function requireUser(req: AuthenticatedRequest): AuthUserPayload {
  if (!req.user) {
    throw new UnauthorizedException('Authentication required');
  }
  return req.user;
}

@Controller('groups')
@Auth('lecturer', 'admin')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  listGroups(
    @Req() req: AuthenticatedRequest,
    @Query('courseId') rawCourseId?: unknown,
  ): Promise<GroupDto[]> {
    const courseId = rawCourseId === undefined ? undefined : parseUuid(rawCourseId, 'courseId');
    return this.groupsService.listGroups(requireUser(req), courseId);
  }

  @Get(':id')
  getGroup(@Req() req: AuthenticatedRequest, @Param('id') rawId: string): Promise<GroupDto> {
    const id = parseUuid(rawId, 'id');
    return this.groupsService.getGroup(requireUser(req), id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createGroup(@Req() req: AuthenticatedRequest): Promise<GroupDto> {
    if (!req.is('application/json')) {
      throw new UnsupportedMediaTypeException('Content-Type must be application/json');
    }
    const input = parseCreateGroupBody(req.body);
    return this.groupsService.createGroup(requireUser(req), input);
  }

  @Patch(':id')
  updateGroup(@Req() req: AuthenticatedRequest, @Param('id') rawId: string): Promise<GroupDto> {
    if (!req.is('application/json')) {
      throw new UnsupportedMediaTypeException('Content-Type must be application/json');
    }
    const id = parseUuid(rawId, 'id');
    const input = parseUpdateGroupBody(req.body);
    return this.groupsService.updateGroup(requireUser(req), id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGroup(@Req() req: AuthenticatedRequest, @Param('id') rawId: string): Promise<void> {
    const id = parseUuid(rawId, 'id');
    return this.groupsService.deleteGroup(requireUser(req), id);
  }
}
