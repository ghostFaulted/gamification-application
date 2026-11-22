import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CourseDto, GroupDto } from '@gamification/shared';
import type { AuthUserPayload } from '../auth/token.service';
import {
  DuplicateCourseCodeError,
  DuplicateGroupNameError,
  GroupsRepository,
  type CourseRecord,
  type GroupRecord,
} from '../db';
import type {
  ValidatedCreateCourseInput,
  ValidatedCreateGroupInput,
  ValidatedUpdateGroupInput,
} from './groups.validation';

function toCourseDto(record: CourseRecord): CourseDto {
  return {
    id: record.id,
    name: record.name,
    code: record.code,
    description: record.description,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toGroupDto(record: GroupRecord): GroupDto {
  return {
    id: record.id,
    courseId: record.courseId,
    courseName: record.courseName,
    courseCode: record.courseCode,
    lecturerId: record.lecturerId,
    lecturerLogin: record.lecturerLogin,
    name: record.name,
    semester: record.semester,
    description: record.description,
    studentCount: record.studentCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

@Injectable()
export class GroupsService {
  constructor(private readonly repository: GroupsRepository) {}

  async listCourses(): Promise<CourseDto[]> {
    const records = await this.repository.findCourses();
    return records.map(toCourseDto);
  }

  async createCourse(
    actor: AuthUserPayload,
    input: ValidatedCreateCourseInput,
  ): Promise<CourseDto> {
    try {
      const created = await this.repository.createCourse({
        name: input.name,
        code: input.code,
        description: input.description,
        createdBy: actor.sub,
      });
      return toCourseDto(created);
    } catch (error) {
      if (error instanceof DuplicateCourseCodeError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async listGroups(actor: AuthUserPayload, courseId?: string): Promise<GroupDto[]> {
    const records = await this.repository.findGroups({
      lecturerId: actor.role === 'admin' ? undefined : actor.sub,
      courseId,
    });
    return records.map(toGroupDto);
  }

  async getGroup(actor: AuthUserPayload, groupId: string): Promise<GroupDto> {
    const group = await this.findOwnedOrAdminGroup(actor, groupId);
    return toGroupDto(group);
  }

  async createGroup(actor: AuthUserPayload, input: ValidatedCreateGroupInput): Promise<GroupDto> {
    const lecturerId = await this.resolveGroupOwner(actor, input.lecturerId);

    const course = await this.repository.findCourseById(input.courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    try {
      const created = await this.repository.createGroup({
        courseId: input.courseId,
        lecturerId,
        name: input.name,
        semester: input.semester,
        description: input.description,
      });
      return toGroupDto(created);
    } catch (error) {
      if (error instanceof DuplicateGroupNameError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async updateGroup(
    actor: AuthUserPayload,
    groupId: string,
    input: ValidatedUpdateGroupInput,
  ): Promise<GroupDto> {
    await this.findOwnedOrAdminGroup(actor, groupId);

    try {
      const updated = await this.repository.updateGroup(groupId, input);
      if (!updated) {
        throw new NotFoundException('Group not found');
      }
      return toGroupDto(updated);
    } catch (error) {
      if (error instanceof DuplicateGroupNameError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async deleteGroup(actor: AuthUserPayload, groupId: string): Promise<void> {
    await this.findOwnedOrAdminGroup(actor, groupId);

    const deleted = await this.repository.deleteGroup(groupId);
    if (!deleted) {
      throw new NotFoundException('Group not found');
    }
  }

  private async findOwnedOrAdminGroup(
    actor: AuthUserPayload,
    groupId: string,
  ): Promise<GroupRecord> {
    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    if (actor.role !== 'admin' && group.lecturerId !== actor.sub) {
      throw new ForbiddenException('You do not have permission to access this group');
    }
    return group;
  }

  private async resolveGroupOwner(
    actor: AuthUserPayload,
    requestedLecturerId: string | undefined,
  ): Promise<string> {
    if (requestedLecturerId === undefined || requestedLecturerId === actor.sub) {
      return actor.sub;
    }

    if (actor.role !== 'admin') {
      throw new ForbiddenException('Lecturers can only create groups assigned to themselves');
    }

    const owner = await this.repository.findUserById(requestedLecturerId);
    if (!owner) {
      throw new NotFoundException('Assigned lecturer not found');
    }
    if (owner.role === 'student') {
      throw new BadRequestException('Group owner must have lecturer or admin role');
    }

    return owner.id;
  }
}
