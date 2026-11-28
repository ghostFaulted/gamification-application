import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CourseDto,
  GroupCatalogItemDto,
  GroupDto,
  GroupStudentDto,
  GroupStudentsImportReport,
} from '@gamification/shared';
import type { AuthUserPayload } from '../auth/token.service';
import {
  DuplicateCourseCodeError,
  DuplicateGroupNameError,
  GroupNotFoundError,
  GroupsRepository,
  type CourseRecord,
  type GroupCatalogRecord,
  type GroupRecord,
} from '../db';
import { CsvParserService, type UploadedCsvFile } from '../users/csv-parser.service';
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

function toGroupCatalogItemDto(record: GroupCatalogRecord): GroupCatalogItemDto {
  return {
    id: record.id,
    courseId: record.courseId,
    courseName: record.courseName,
    courseCode: record.courseCode,
    name: record.name,
    semester: record.semester,
    lecturerLogin: record.lecturerLogin,
  };
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly repository: GroupsRepository,
    private readonly csvParser: CsvParserService,
  ) {}

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

  async listGroupCatalog(): Promise<GroupCatalogItemDto[]> {
    const records = await this.repository.findGroupCatalog();
    return records.map(toGroupCatalogItemDto);
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

  async listGroupStudents(actor: AuthUserPayload, groupId: string): Promise<GroupStudentDto[]> {
    await this.findOwnedOrAdminGroup(actor, groupId);
    const records = await this.repository.findGroupStudents(groupId);
    return records.map((record) => ({
      id: record.id,
      login: record.login,
      assignedAt: record.assignedAt.toISOString(),
    }));
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

  async importStudents(
    actor: AuthUserPayload,
    groupId: string,
    file: UploadedCsvFile | undefined,
  ): Promise<GroupStudentsImportReport> {
    // GroupAccessGuard already checked this before the upload was read; kept for other callers.
    await this.findOwnedOrAdminGroup(actor, groupId);
    // Throws 400 for a missing, non-CSV, empty or malformed file.
    const parsed = this.csvParser.parseUsersCsv(file);

    try {
      const result = await this.repository.importStudents(groupId, parsed.validLogins);
      return {
        added: result.addedLogins.length,
        addedLogins: result.addedLogins,
        createdAccounts: result.createdLogins.length,
        createdLogins: result.createdLogins,
        alreadyInGroup: result.alreadyInGroupLogins.length,
        alreadyInGroupLogins: result.alreadyInGroupLogins,
        notStudentLogins: result.notStudentLogins,
        duplicatesInFile: result.duplicatesCount,
        invalid: parsed.invalidRowsCount,
        errors: parsed.errors,
      };
    } catch (error) {
      if (error instanceof GroupNotFoundError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /** Throws 404 for a missing group and 403 when the actor is neither its owner nor an admin. */
  async assertGroupAccess(actor: AuthUserPayload, groupId: string): Promise<void> {
    await this.findOwnedOrAdminGroup(actor, groupId);
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
