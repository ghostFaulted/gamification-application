import { Injectable } from '@nestjs/common';
import type { Role } from '@gamification/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './client.js';
import {
  classifyImportedStudents,
  prepareImportLogins,
  type ImportGroupStudentsResult,
} from './group-students-import.js';
import { courses, groups, groupStudents, users, type Course } from './schema/index.js';
import type { AppDatabase } from './users.repository.js';

export {
  classifyImportedStudents,
  prepareImportLogins,
  type ImportGroupStudentsResult,
} from './group-students-import.js';

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

export interface GroupStudentRecord {
  id: string;
  login: string;
  assignedAt: Date;
}

export class GroupNotFoundError extends Error {
  constructor() {
    super('Group not found');
    this.name = 'GroupNotFoundError';
  }
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

const IMPORT_CHUNK_SIZE = 1000;

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < items.length; offset += IMPORT_CHUNK_SIZE) {
    result.push(items.slice(offset, offset + IMPORT_CHUNK_SIZE));
  }
  return result;
}

/**
 * Adds students to a group in one transaction: creates missing student accounts, then links
 * every student login to the group. Lecturer/admin accounts are reported, never linked.
 * Only adds; students missing from the input stay in the group.
 */
export async function importGroupStudents(
  groupId: string,
  rawLogins: readonly string[],
  database: AppDatabase = db,
): Promise<ImportGroupStudentsResult> {
  const { uniqueLogins, duplicatesCount } = prepareImportLogins(rawLogins);
  // Rows are written in sorted order, not file order: concurrent imports of overlapping logins
  // then wait on each other in the same order instead of deadlocking (40P01).
  const sortedLogins = [...uniqueLogins].sort();

  return database.transaction(async (tx) => {
    // FOR SHARE keeps the group from being deleted until the import commits.
    const [group] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, groupId))
      .for('share');
    if (!group) {
      throw new GroupNotFoundError();
    }

    const created = new Set<string>();
    const accounts = new Map<string, { id: string; role: Role }>();
    const added = new Set<string>();

    for (const chunk of chunks(sortedLogins)) {
      const inserted = await tx
        .insert(users)
        .values(chunk.map((login) => ({ login, role: 'student' as const })))
        .onConflictDoNothing()
        .returning({ login: users.login });
      for (const row of inserted) {
        created.add(row.login);
      }

      const rows = await tx
        .select({ id: users.id, login: users.login, role: users.role })
        .from(users)
        .where(inArray(sql`lower(${users.login})`, chunk));
      for (const row of rows) {
        accounts.set(row.login.toLowerCase(), { id: row.id, role: row.role });
      }
    }

    const studentIds = uniqueLogins
      .flatMap((login) => {
        const account = accounts.get(login);
        return account?.role === 'student' ? [account.id] : [];
      })
      .sort();

    for (const chunk of chunks(studentIds)) {
      const linked = await tx
        .insert(groupStudents)
        .values(chunk.map((studentId) => ({ groupId, studentId })))
        .onConflictDoNothing()
        .returning({ studentId: groupStudents.studentId });
      for (const row of linked) {
        added.add(row.studentId);
      }
    }

    return classifyImportedStudents({
      uniqueLogins,
      accounts,
      created,
      added,
      duplicatesCount,
    });
  });
}

/**
 * Students of a group, oldest assignment first (one import shares the timestamp, so then by
 * login). Returns an empty list for a group without students or a missing group.
 */
export async function findGroupStudents(
  groupId: string,
  database: AppDatabase = db,
): Promise<GroupStudentRecord[]> {
  return database
    .select({
      id: users.id,
      login: users.login,
      assignedAt: groupStudents.assignedAt,
    })
    .from(groupStudents)
    .innerJoin(users, eq(groupStudents.studentId, users.id))
    .where(eq(groupStudents.groupId, groupId))
    .orderBy(asc(groupStudents.assignedAt), asc(users.login));
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
  abstract findGroupStudents(groupId: string): Promise<GroupStudentRecord[]>;
  abstract importStudents(
    groupId: string,
    logins: readonly string[],
  ): Promise<ImportGroupStudentsResult>;
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

  async findGroupStudents(groupId: string): Promise<GroupStudentRecord[]> {
    return findGroupStudents(groupId);
  }

  async importStudents(
    groupId: string,
    logins: readonly string[],
  ): Promise<ImportGroupStudentsResult> {
    return importGroupStudents(groupId, logins);
  }
}
