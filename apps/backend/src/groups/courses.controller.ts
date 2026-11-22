import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UnsupportedMediaTypeException,
  UseGuards,
} from '@nestjs/common';
import type { CourseDto } from '@gamification/shared';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthUserPayload } from '../auth/token.service';
import { GroupsService } from './groups.service';
import { parseCreateCourseBody } from './groups.validation';

function requireUser(req: AuthenticatedRequest): AuthUserPayload {
  if (!req.user) {
    throw new UnauthorizedException('Authentication required');
  }
  return req.user;
}

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard('lecturer', 'admin'))
export class CoursesController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  listCourses(): Promise<CourseDto[]> {
    return this.groupsService.listCourses();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createCourse(@Req() req: AuthenticatedRequest): Promise<CourseDto> {
    if (!req.is('application/json')) {
      throw new UnsupportedMediaTypeException('Content-Type must be application/json');
    }
    const input = parseCreateCourseBody(req.body);
    return this.groupsService.createCourse(requireUser(req), input);
  }
}
