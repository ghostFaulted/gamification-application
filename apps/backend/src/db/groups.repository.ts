import { Injectable } from '@nestjs/common';
import type { Role } from '@gamification/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './client.js';
import { courses, groups, groupStudents, users, type Course } from './schema/index.js';

export type CourseRecord = Course;

export interface GroupRecord {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string | null;
  lecturerId: string;
  lecturerLogin: string;
  name: string;
  semester: string | null;
  description: string | null;
  studentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCourseData {
  name: string;
  code: string | null;
  description: string | null;
  createdBy: string | null;
}

export interface CreateGroupData {
  courseId: string;
  lecturerId: string;
  name: string;
  semester: string | null;
  description: string | null;
}

export interface UpdateGroupData {
  name?: string;
  semester?: string | null;
  description?: string | null;
}

export interface FindGroupsFilter {
  lecturerId?: string;
  courseId?: string;
}

export interface UserSummary {
  id: string;
  login: string;
  role: Role;
}

export class DuplicateCourseCodeError extends Error {
  constructor() {
    super('A course with this code already exists');
    this.name = 'DuplicateCourseCodeError';
  }
}

export class DuplicateGroupNameError extends Error {
  constructor() {
    super('A group with this name already exists in the selected course');
    this.name = 'DuplicateGroupNameError';
  }
}

interface PgErrorShape {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
}

function extractPgError(error: unknown): { code?: string; constraint?: string } {
  if (!error || typeof error !== 'object') {
    return {};
  }
  const current = error as PgErrorShape;
  if (typeof current.code === 'string') {
    return {
      code: current.code,
      constraint: typeof current.constraint === 'string' ? current.constraint : undefined,
    };
  }
  if (current.cause && typeof current.cause === 'object') {
    const cause = current.cause as PgErrorShape;
    if (typeof cause.code === 'string') {
      return {
        code: cause.code,
        constraint: typeof cause.constraint === 'string' ? cause.constraint : undefined,
      };
    }
  }
  return {};
}

export abstract class GroupsRepository {
  abstract findUserById(id: string): Promise<UserSummary | null>;
  abstract findCourses(): Promise<CourseRecord[]>;
  abstract findCourseById(id: string): Promise<CourseRecord | null>;
  abstract createCourse(data: CreateCourseData): Promise<CourseRecord>;
  abstract findGroups(filter?: FindGroupsFilter): Promise<GroupRecord[]>;
  abstract findGroupById(id: string): Promise<GroupRecord | null>;
  abstract createGroup(data: CreateGroupData): Promise<GroupRecord>;
  abstract updateGroup(id: string, data: UpdateGroupData): Promise<GroupRecord | null>;
  abstract deleteGroup(id: string): Promise<boolean>;
}

@Injectable()
export class DrizzleGroupsRepository extends GroupsRepository {
  async findUserById(id: string): Promise<UserSummary | null> {
    const [row] = await db
      .select({ id: users.id, login: users.login, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return row ?? null;
  }

  async findCourses(): Promise<CourseRecord[]> {
    return db.select().from(courses).orderBy(asc(courses.name));
  }

  async findCourseById(id: string): Promise<CourseRecord | null> {
    const [row] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
    return row ?? null;
  }

  async createCourse(data: CreateCourseData): Promise<CourseRecord> {
    try {
      const [created] = await db
        .insert(courses)
        .values({
          name: data.name,
          code: data.code,
          description: data.description,
          createdBy: data.createdBy,
        })
        .returning();

      return created;
    } catch (error) {
      const pgError = extractPgError(error);
      if (pgError.code === '23505' && pgError.constraint === 'courses_code_unique') {
        throw new DuplicateCourseCodeError();
      }
      throw error;
    }
  }

  async findGroups(filter: FindGroupsFilter = {}): Promise<GroupRecord[]> {
    const conditions = [];
    if (filter.lecturerId !== undefined) {
      conditions.push(eq(groups.lecturerId, filter.lecturerId));
    }
    if (filter.courseId !== undefined) {
      conditions.push(eq(groups.courseId, filter.courseId));
    }

    return db
      .select({
        id: groups.id,
        courseId: groups.courseId,
        courseName: courses.name,
        courseCode: courses.code,
        lecturerId: groups.lecturerId,
        lecturerLogin: users.login,
        name: groups.name,
        semester: groups.semester,
        description: groups.description,
        studentCount: sql<number>`count(${groupStudents.studentId})::int`,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
      })
      .from(groups)
      .innerJoin(courses, eq(groups.courseId, courses.id))
      .innerJoin(users, eq(groups.lecturerId, users.id))
      .leftJoin(groupStudents, eq(groups.id, groupStudents.groupId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(groups.id, courses.id, users.id)
      .orderBy(asc(courses.name), asc(groups.name));
  }

  async findGroupById(id: string): Promise<GroupRecord | null> {
    const [row] = await db
      .select({
        id: groups.id,
        courseId: groups.courseId,
        courseName: courses.name,
        courseCode: courses.code,
        lecturerId: groups.lecturerId,
        lecturerLogin: users.login,
        name: groups.name,
        semester: groups.semester,
        description: groups.description,
        studentCount: sql<number>`count(${groupStudents.studentId})::int`,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
      })
      .from(groups)
      .innerJoin(courses, eq(groups.courseId, courses.id))
      .innerJoin(users, eq(groups.lecturerId, users.id))
      .leftJoin(groupStudents, eq(groups.id, groupStudents.groupId))
      .where(eq(groups.id, id))
      .groupBy(groups.id, courses.id, users.id)
      .limit(1);

    return row ?? null;
  }

  async createGroup(data: CreateGroupData): Promise<GroupRecord> {
    let insertedId: string;
    try {
      const [inserted] = await db
        .insert(groups)
        .values({
          courseId: data.courseId,
          lecturerId: data.lecturerId,
          name: data.name,
          semester: data.semester,
          description: data.description,
        })
        .returning({ id: groups.id });
      insertedId = inserted.id;
    } catch (error) {
      const pgError = extractPgError(error);
      if (pgError.code === '23505' && pgError.constraint === 'groups_course_name_unique') {
        throw new DuplicateGroupNameError();
      }
      throw error;
    }

    const record = await this.findGroupById(insertedId);
    if (!record) {
      throw new Error(`Created group "${insertedId}" could not be reloaded`);
    }
    return record;
  }

  async updateGroup(id: string, data: UpdateGroupData): Promise<GroupRecord | null> {
    const patch: Partial<typeof groups.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) {
      patch.name = data.name;
    }
    if (data.semester !== undefined) {
      patch.semester = data.semester;
    }
    if (data.description !== undefined) {
      patch.description = data.description;
    }

    let updatedId: string | undefined;
    try {
      const [updated] = await db
        .update(groups)
        .set(patch)
        .where(eq(groups.id, id))
        .returning({ id: groups.id });
      updatedId = updated?.id;
    } catch (error) {
      const pgError = extractPgError(error);
      if (pgError.code === '23505' && pgError.constraint === 'groups_course_name_unique') {
        throw new DuplicateGroupNameError();
      }
      throw error;
    }

    if (!updatedId) {
      return null;
    }
    return this.findGroupById(updatedId);
  }

  async deleteGroup(id: string): Promise<boolean> {
    const rows = await db.delete(groups).where(eq(groups.id, id)).returning({ id: groups.id });
    return rows.length > 0;
  }
}
