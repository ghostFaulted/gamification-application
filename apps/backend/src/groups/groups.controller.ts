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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  GroupCatalogItemDto,
  GroupDto,
  GroupStudentDto,
  GroupStudentsImportReport,
} from '@gamification/shared';
import { Auth } from '../auth/auth.decorator';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { MAX_CSV_SIZE_BYTES, type UploadedCsvFile } from '../users/csv-parser.service';
import type { AuthUserPayload } from '../auth/token.service';
import { GroupAccessGuard } from './group-access.guard';
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

  // Must stay above @Get(':id') so "catalog" is not matched as a group UUID.
  @Get('catalog')
  @Auth('student', 'lecturer', 'admin')
  listGroupCatalog(): Promise<GroupCatalogItemDto[]> {
    return this.groupsService.listGroupCatalog();
  }

  @Get(':id')
  getGroup(@Req() req: AuthenticatedRequest, @Param('id') rawId: string): Promise<GroupDto> {
    const id = parseUuid(rawId, 'id');
    return this.groupsService.getGroup(requireUser(req), id);
  }

  @Get(':id/students')
  listGroupStudents(
    @Req() req: AuthenticatedRequest,
    @Param('id') rawId: string,
  ): Promise<GroupStudentDto[]> {
    const id = parseUuid(rawId, 'id');
    return this.groupsService.listGroupStudents(requireUser(req), id);
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

  @Post(':id/students/import')
  @HttpCode(HttpStatus.OK)
  // Runs after the controller-level @Auth guards and before FileInterceptor.
  @UseGuards(GroupAccessGuard)
  // Same upload limits as POST /api/users/import.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_CSV_SIZE_BYTES, files: 1, fields: 0 } }),
  )
  importStudents(
    @Req() req: AuthenticatedRequest,
    @Param('id') rawId: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
  ): Promise<GroupStudentsImportReport> {
    const id = parseUuid(rawId, 'id');
    return this.groupsService.importStudents(requireUser(req), id, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGroup(@Req() req: AuthenticatedRequest, @Param('id') rawId: string): Promise<void> {
    const id = parseUuid(rawId, 'id');
    return this.groupsService.deleteGroup(requireUser(req), id);
  }
}
