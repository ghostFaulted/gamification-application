import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@gamification/shared';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME } from '../src/auth/auth.constants';
import { RevokedTokensRepository } from '../src/auth/revoked-tokens.repository';
import { TokenService } from '../src/auth/token.service';
import {
  DuplicateCourseCodeError,
  DuplicateGroupNameError,
  GroupNotFoundError,
  GroupsRepository,
  type CourseRecord,
  type CreateCourseData,
  type CreateGroupData,
  type FindGroupsFilter,
  type GroupRecord,
  type GroupStudentRecord,
  type ImportGroupStudentsResult,
  type UpdateGroupData,
  type UserSummary,
  classifyImportedStudents,
  prepareImportLogins,
} from '../src/db';
import { setupApp } from '../src/setup-app';

const LECTURER_1: UserSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  login: 'lecturer1',
  role: 'lecturer',
};
const LECTURER_2: UserSummary = {
  id: '22222222-2222-4222-8222-222222222222',
  login: 'lecturer2',
  role: 'lecturer',
};
const ADMIN_1: UserSummary = {
  id: '33333333-3333-4333-8333-333333333333',
  login: 'admin1',
  role: 'admin',
};
const STUDENT_1: UserSummary = {
  id: '44444444-4444-4444-8444-444444444444',
  login: 'student1',
  role: 'student',
};

class NoRevokedTokensRepository extends RevokedTokensRepository {
  async revoke(): Promise<void> {}
  async isRevoked(): Promise<boolean> {
    return false;
  }
}

const SEED_USERS: readonly UserSummary[] = [LECTURER_1, LECTURER_2, ADMIN_1, STUDENT_1];

class InMemoryGroupsRepository extends GroupsRepository {
  readonly users = new Map<string, UserSummary>(SEED_USERS.map((user) => [user.id, user]));
  readonly courses = new Map<string, CourseRecord>();
  readonly groups = new Map<
    string,
    {
      id: string;
      courseId: string;
      lecturerId: string;
      name: string;
      semester: string | null;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();
  /** Students of each group, keyed by group id. */
  readonly students = new Map<string, GroupStudentRecord[]>();

  reset(): void {
    this.courses.clear();
    this.groups.clear();
    this.students.clear();
    this.users.clear();
    for (const user of SEED_USERS) {
      this.users.set(user.id, user);
    }
  }

  async findUserById(id: string): Promise<UserSummary | null> {
    return this.users.get(id) ?? null;
  }

  async findCourses(): Promise<CourseRecord[]> {
    return Array.from(this.courses.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async findCourseById(id: string): Promise<CourseRecord | null> {
    return this.courses.get(id) ?? null;
  }

  async createCourse(data: CreateCourseData): Promise<CourseRecord> {
    if (data.code !== null) {
      const normalized = data.code.toLowerCase();
      for (const existing of this.courses.values()) {
        if (existing.code?.toLowerCase() === normalized) {
          throw new DuplicateCourseCodeError();
        }
      }
    }
    const now = new Date();
    const record: CourseRecord = {
      id: randomUUID(),
      name: data.name,
      code: data.code,
      description: data.description,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.courses.set(record.id, record);
    return record;
  }

  async findGroups(filter: FindGroupsFilter = {}): Promise<GroupRecord[]> {
    return Array.from(this.groups.values())
      .filter(
        (g) =>
          (filter.lecturerId === undefined || g.lecturerId === filter.lecturerId) &&
          (filter.courseId === undefined || g.courseId === filter.courseId),
      )
      .map((g) => this.hydrateGroup(g))
      .sort((a, b) => a.courseName.localeCompare(b.courseName) || a.name.localeCompare(b.name));
  }

  async findGroupById(id: string): Promise<GroupRecord | null> {
    const raw = this.groups.get(id);
    return raw ? this.hydrateGroup(raw) : null;
  }

  async createGroup(data: CreateGroupData): Promise<GroupRecord> {
    const normalizedName = data.name.toLowerCase();
    for (const existing of this.groups.values()) {
      if (existing.courseId === data.courseId && existing.name.toLowerCase() === normalizedName) {
        throw new DuplicateGroupNameError();
      }
    }
    const now = new Date();
    const raw = {
      id: randomUUID(),
      courseId: data.courseId,
      lecturerId: data.lecturerId,
      name: data.name,
      semester: data.semester,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };
    this.groups.set(raw.id, raw);
    return this.hydrateGroup(raw);
  }

  async updateGroup(id: string, data: UpdateGroupData): Promise<GroupRecord | null> {
    const raw = this.groups.get(id);
    if (!raw) {
      return null;
    }
    if (data.name !== undefined) {
      const normalizedName = data.name.toLowerCase();
      for (const existing of this.groups.values()) {
        if (
          existing.id !== id &&
          existing.courseId === raw.courseId &&
          existing.name.toLowerCase() === normalizedName
        ) {
          throw new DuplicateGroupNameError();
        }
      }
      raw.name = data.name;
    }
    if (data.semester !== undefined) {
      raw.semester = data.semester;
    }
    if (data.description !== undefined) {
      raw.description = data.description;
    }
    raw.updatedAt = new Date();
    return this.hydrateGroup(raw);
  }

  async deleteGroup(id: string): Promise<boolean> {
    const deleted = this.groups.delete(id);
    this.students.delete(id);
    return deleted;
  }

  async findGroupStudents(groupId: string): Promise<GroupStudentRecord[]> {
    return this.students.get(groupId) ?? [];
  }

  async importStudents(
    groupId: string,
    rawLogins: readonly string[],
  ): Promise<ImportGroupStudentsResult> {
    if (!this.groups.has(groupId)) {
      throw new GroupNotFoundError();
    }

    const { uniqueLogins, duplicatesCount } = prepareImportLogins(rawLogins);
    const members = this.students.get(groupId) ?? [];
    const memberIds = new Set(members.map((student) => student.id));
    const accounts = new Map<string, { id: string; role: UserSummary['role'] }>();
    const created = new Set<string>();
    const added = new Set<string>();

    for (const login of uniqueLogins) {
      let account = [...this.users.values()].find((user) => user.login.toLowerCase() === login);
      if (!account) {
        account = { id: randomUUID(), login, role: 'student' };
        this.users.set(account.id, account);
        created.add(login);
      }
      accounts.set(login, { id: account.id, role: account.role });
      if (account.role === 'student' && !memberIds.has(account.id)) {
        members.push({ id: account.id, login: account.login, assignedAt: new Date() });
        memberIds.add(account.id);
        added.add(account.id);
      }
    }

    this.students.set(groupId, members);
    return classifyImportedStudents({
      uniqueLogins,
      accounts,
      created,
      added,
      duplicatesCount,
    });
  }

  private hydrateGroup(raw: {
    id: string;
    courseId: string;
    lecturerId: string;
    name: string;
    semester: string | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): GroupRecord {
    const course = this.courses.get(raw.courseId)!;
    const lecturer = this.users.get(raw.lecturerId)!;
    return {
      ...raw,
      courseName: course.name,
      courseCode: course.code,
      lecturerLogin: lecturer.login,
      studentCount: this.students.get(raw.id)?.length ?? 0,
    };
  }
}

describe('Courses and Groups CRUD (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let repository: InMemoryGroupsRepository;

  function cookieFor(user: { id: string; login: string; role: Role }): string {
    const token = tokenService.signAccessToken({
      userId: user.id,
      login: user.login,
      role: user.role,
    });
    return `${AUTH_COOKIE_NAME}=${token}`;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RevokedTokensRepository)
      .useClass(NoRevokedTokensRepository)
      .overrideProvider(GroupsRepository)
      .useClass(InMemoryGroupsRepository)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    tokenService = moduleRef.get(TokenService);
    repository = moduleRef.get(GroupsRepository);
  });

  beforeEach(() => {
    repository.reset();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects unauthenticated requests with 401 and student requests with 403', async () => {
    await request(app.getHttpServer()).get('/api/groups').expect(401);
    await request(app.getHttpServer()).get('/api/courses').expect(401);

    await request(app.getHttpServer())
      .get('/api/groups')
      .set('Cookie', cookieFor(STUDENT_1))
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(STUDENT_1))
      .send({ name: 'IO' })
      .expect(403);
  });

  it('creates and lists courses and rejects duplicate course codes (case-insensitive)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Inżynieria oprogramowania', code: '06INFS' })
      .expect(201);

    expect(created.body).toEqual(
      expect.objectContaining({
        name: 'Inżynieria oprogramowania',
        code: '06INFS',
        createdBy: LECTURER_1.id,
      }),
    );

    await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Inny przedmiot', code: '06infs' })
      .expect(409);

    const list = await request(app.getHttpServer())
      .get('/api/courses')
      .set('Cookie', cookieFor(LECTURER_2))
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('supports full CRUD for lecturer own groups and isolates groups between lecturers', async () => {
    const courseRes = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Inżynieria oprogramowania' })
      .expect(201);
    const courseId = courseRes.body.id as string;

    const createRes = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId, name: 'Grupa 1', semester: '2026/27-Z', description: 'Wtorek 10:15' })
      .expect(201);
    const groupId = createRes.body.id as string;

    expect(createRes.body).toEqual(
      expect.objectContaining({
        id: groupId,
        courseId,
        courseName: 'Inżynieria oprogramowania',
        lecturerId: LECTURER_1.id,
        lecturerLogin: 'lecturer1',
        name: 'Grupa 1',
        semester: '2026/27-Z',
        studentCount: 0,
      }),
    );

    // Duplicate group name in same course (case-insensitive) -> 409
    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId, name: 'grupa 1' })
      .expect(409);

    // Lecturer 1 sees own group; Lecturer 2 sees empty list; Admin sees all
    const l1List = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(200);
    expect(l1List.body).toHaveLength(1);

    const l2List = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Cookie', cookieFor(LECTURER_2))
      .expect(200);
    expect(l2List.body).toHaveLength(0);

    const adminList = await request(app.getHttpServer())
      .get(`/api/groups?courseId=${courseId}`)
      .set('Cookie', cookieFor(ADMIN_1))
      .expect(200);
    expect(adminList.body).toHaveLength(1);

    // IDOR protection: Lecturer 2 cannot read, update, or delete Lecturer 1's group
    await request(app.getHttpServer())
      .get(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_2))
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_2))
      .send({ name: 'Przejęta grupa' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_2))
      .expect(403);

    // Lecturer 1 updates own group
    const updated = await request(app.getHttpServer())
      .patch(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Grupa 1A', semester: null })
      .expect(200);
    expect(updated.body).toEqual(expect.objectContaining({ name: 'Grupa 1A', semester: null }));

    // Lecturer 1 deletes own group
    await request(app.getHttpServer())
      .delete(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(404);
  });

  it('prevents lecturer from assigning another owner, allows admin to assign lecturer, and validates inputs', async () => {
    const courseRes = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(ADMIN_1))
      .send({ name: 'Algorytmy' })
      .expect(201);
    const courseId = courseRes.body.id as string;

    // Lecturer cannot create a group for another lecturer
    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId, name: 'G1', lecturerId: LECTURER_2.id })
      .expect(403);

    // Admin cannot assign a student as group owner
    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(ADMIN_1))
      .send({ courseId, name: 'G1', lecturerId: STUDENT_1.id })
      .expect(400);

    // Admin can assign Lecturer 2 as group owner
    const adminCreated = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(ADMIN_1))
      .send({ courseId, name: 'G1', lecturerId: LECTURER_2.id })
      .expect(201);
    expect(adminCreated.body.lecturerId).toBe(LECTURER_2.id);

    // Non-existent course -> 404
    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId: '99999999-9999-4999-8999-999999999999', name: 'G2' })
      .expect(404);

    // Invalid UUID -> 400
    await request(app.getHttpServer())
      .get('/api/groups/not-a-uuid')
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(400);

    // Non-JSON content-type -> 415
    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('name=G3')
      .expect(415);
  });

  describe('GET /api/groups/:id/students', () => {
    async function createGroupOf(owner: UserSummary): Promise<string> {
      const courseRes = await request(app.getHttpServer())
        .post('/api/courses')
        .set('Cookie', cookieFor(ADMIN_1))
        .send({ name: 'Programowanie obiektowe' })
        .expect(201);
      const groupRes = await request(app.getHttpServer())
        .post('/api/groups')
        .set('Cookie', cookieFor(ADMIN_1))
        .send({ courseId: courseRes.body.id, name: 'Grupa 2', lecturerId: owner.id })
        .expect(201);
      return groupRes.body.id as string;
    }

    it('returns the students of the lecturer own group with ISO assignment dates', async () => {
      const groupId = await createGroupOf(LECTURER_1);
      repository.students.set(groupId, [
        { id: STUDENT_1.id, login: 's500001', assignedAt: new Date('2026-11-18T10:00:00.000Z') },
        {
          id: '55555555-5555-4555-8555-555555555555',
          login: 's500002',
          assignedAt: new Date('2026-11-18T10:00:00.000Z'),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/students`)
        .set('Cookie', cookieFor(LECTURER_1))
        .expect(200);

      expect(res.body).toEqual([
        { id: STUDENT_1.id, login: 's500001', assignedAt: '2026-11-18T10:00:00.000Z' },
        {
          id: '55555555-5555-4555-8555-555555555555',
          login: 's500002',
          assignedAt: '2026-11-18T10:00:00.000Z',
        },
      ]);
    });

    it('returns an empty list for a group without students', async () => {
      const groupId = await createGroupOf(LECTURER_1);

      const res = await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/students`)
        .set('Cookie', cookieFor(LECTURER_1))
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('lets an admin read the students of any group', async () => {
      const groupId = await createGroupOf(LECTURER_2);

      await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/students`)
        .set('Cookie', cookieFor(ADMIN_1))
        .expect(200);
    });

    it('returns 403 for another lecturer group, 404 for a missing group and 400 for a bad id', async () => {
      const groupId = await createGroupOf(LECTURER_2);

      await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/students`)
        .set('Cookie', cookieFor(LECTURER_1))
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/groups/99999999-9999-4999-8999-999999999999/students')
        .set('Cookie', cookieFor(LECTURER_1))
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/groups/not-a-uuid/students')
        .set('Cookie', cookieFor(LECTURER_1))
        .expect(400);
    });

    it('returns 401 without a session and 403 for a student', async () => {
      const groupId = await createGroupOf(LECTURER_1);

      await request(app.getHttpServer()).get(`/api/groups/${groupId}/students`).expect(401);
      await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/students`)
        .set('Cookie', cookieFor(STUDENT_1))
        .expect(403);
    });
  });

  it('validates create and update payloads and returns 404 for a missing group', async () => {
    const courseRes = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Inżynieria oprogramowania' })
      .expect(201);
    const courseId = courseRes.body.id as string;

    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId, name: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Grupa 1' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(STUDENT_1))
      .send({ courseId, name: 'Grupa 1' })
      .expect(403);

    const first = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId, name: 'Grupa 1' })
      .expect(201);
    const groupId = first.body.id as string;

    await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId, name: 'Grupa 2' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: '  ' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('name=Grupa%201A')
      .expect(415);

    await request(app.getHttpServer())
      .patch(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'grupa 2' })
      .expect(409);

    const missingId = '99999999-9999-4999-8999-999999999999';
    for (const user of [LECTURER_1, ADMIN_1]) {
      await request(app.getHttpServer())
        .get(`/api/groups/${missingId}`)
        .set('Cookie', cookieFor(user))
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/api/groups/${missingId}`)
        .set('Cookie', cookieFor(user))
        .send({ name: 'Nieistniejąca' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/groups/${missingId}`)
        .set('Cookie', cookieFor(user))
        .expect(404);
    }

    await request(app.getHttpServer())
      .get('/api/groups?courseId=not-a-uuid')
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(400);
  });

  it('filters a lecturer list by course and lets an admin manage another lecturer group', async () => {
    const courseARes = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Inżynieria oprogramowania' })
      .expect(201);
    const courseA = courseARes.body.id as string;

    const courseBRes = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Algorytmy' })
      .expect(201);
    const courseB = courseBRes.body.id as string;

    const groupARes = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId: courseA, name: 'Grupa 1' })
      .expect(201);
    const groupA = groupARes.body.id as string;

    const groupBRes = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId: courseB, name: 'Grupa 2' })
      .expect(201);
    const groupB = groupBRes.body.id as string;

    const filtered = await request(app.getHttpServer())
      .get(`/api/groups?courseId=${courseA}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(200);
    expect(filtered.body).toEqual([expect.objectContaining({ id: groupA, name: 'Grupa 1' })]);

    const ownList = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(200);
    expect(ownList.body).toHaveLength(2);

    const otherList = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Cookie', cookieFor(LECTURER_2))
      .expect(200);
    expect(otherList.body).toHaveLength(0);

    const adminList = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Cookie', cookieFor(ADMIN_1))
      .expect(200);
    expect(adminList.body).toHaveLength(2);

    const adminGet = await request(app.getHttpServer())
      .get(`/api/groups/${groupA}`)
      .set('Cookie', cookieFor(ADMIN_1))
      .expect(200);
    expect(adminGet.body).toEqual(
      expect.objectContaining({ id: groupA, lecturerId: LECTURER_1.id }),
    );

    const adminPatch = await request(app.getHttpServer())
      .patch(`/api/groups/${groupA}`)
      .set('Cookie', cookieFor(ADMIN_1))
      .send({ description: 'Poprawka administratora' })
      .expect(200);
    expect(adminPatch.body.description).toBe('Poprawka administratora');

    const ownerGet = await request(app.getHttpServer())
      .get(`/api/groups/${groupA}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(200);
    expect(ownerGet.body.description).toBe('Poprawka administratora');

    await request(app.getHttpServer())
      .delete(`/api/groups/${groupA}`)
      .set('Cookie', cookieFor(ADMIN_1))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/groups/${groupA}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(404);

    const remaining = await request(app.getHttpServer())
      .get('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(200);
    expect(remaining.body).toEqual([expect.objectContaining({ id: groupB })]);
  });

  it('imports students into a group, skips them on re-import, and rejects an invalid CSV', async () => {
    const courseRes = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Inżynieria oprogramowania' })
      .expect(201);
    const courseId = courseRes.body.id as string;

    const groupRes = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId, name: 'Grupa 1' })
      .expect(201);
    const groupId = groupRes.body.id as string;

    const csv = Buffer.from(
      [
        'login;name',
        's1;Jan',
        'S2;Anna',
        's1;Jan ponownie',
        'student1;Istniejący',
        'lecturer1;Prowadzący',
        'bad login;Ola',
      ].join('\n'),
    );

    const first = await request(app.getHttpServer())
      .post(`/api/groups/${groupId}/students/import`)
      .set('Cookie', cookieFor(LECTURER_1))
      .attach('file', csv, 'students.csv')
      .expect(200);

    expect(first.body).toEqual({
      added: 3,
      addedLogins: ['s1', 's2', 'student1'],
      createdAccounts: 2,
      createdLogins: ['s1', 's2'],
      alreadyInGroup: 0,
      alreadyInGroupLogins: [],
      notStudentLogins: ['lecturer1'],
      duplicatesInFile: 1,
      invalid: 1,
      errors: [{ row: 7, value: 'bad login', reason: 'Login contains invalid characters' }],
    });

    const afterImport = await request(app.getHttpServer())
      .get(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(200);
    expect(afterImport.body.studentCount).toBe(3);

    const second = await request(app.getHttpServer())
      .post(`/api/groups/${groupId}/students/import`)
      .set('Cookie', cookieFor(LECTURER_1))
      .attach('file', csv, 'students.csv')
      .expect(200);

    expect(second.body).toEqual({
      added: 0,
      addedLogins: [],
      createdAccounts: 0,
      createdLogins: [],
      alreadyInGroup: 3,
      alreadyInGroupLogins: ['s1', 's2', 'student1'],
      notStudentLogins: ['lecturer1'],
      duplicatesInFile: 1,
      invalid: 1,
      errors: [{ row: 7, value: 'bad login', reason: 'Login contains invalid characters' }],
    });

    const afterReimport = await request(app.getHttpServer())
      .get(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(200);
    expect(afterReimport.body.studentCount).toBe(3);

    await request(app.getHttpServer())
      .post(`/api/groups/${groupId}/students/import`)
      .set('Cookie', cookieFor(LECTURER_2))
      .attach('file', csv, 'students.csv')
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/groups/${groupId}/students/import`)
      .set('Cookie', cookieFor(LECTURER_1))
      .attach('file', Buffer.from('user\ns1\n'), 'students.csv')
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/groups/${groupId}/students/import`)
      .attach('file', csv, 'students.csv')
      .expect(401);
  });

  it('deletes a group, unenrolls its students and keeps their accounts', async () => {
    const courseRes = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ name: 'Bazy danych' })
      .expect(201);

    const groupRes = await request(app.getHttpServer())
      .post('/api/groups')
      .set('Cookie', cookieFor(LECTURER_1))
      .send({ courseId: courseRes.body.id, name: 'Grupa do usunięcia' })
      .expect(201);
    const groupId = groupRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/groups/${groupId}/students/import`)
      .set('Cookie', cookieFor(LECTURER_1))
      .attach('file', Buffer.from('login\ns500101\ns500102\n'), 'students.csv')
      .expect(200);

    const before = await request(app.getHttpServer())
      .get(`/api/groups/${groupId}/students`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(200);
    expect(before.body).toHaveLength(2);
    const importedIds = (before.body as Array<{ id: string }>).map((row) => row.id);
    for (const id of importedIds) {
      expect(repository.users.has(id)).toBe(true);
    }

    await request(app.getHttpServer())
      .delete(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/groups/${groupId}`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/groups/${groupId}/students`)
      .set('Cookie', cookieFor(LECTURER_1))
      .expect(404);

    expect(repository.students.has(groupId)).toBe(false);
    expect(repository.groups.has(groupId)).toBe(false);
    for (const id of importedIds) {
      expect(repository.users.has(id)).toBe(true);
    }
  });
});
