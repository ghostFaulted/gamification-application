import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Role } from '@gamification/shared';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME, getJwtSecret } from '../src/auth/auth.constants';
import { RevokedTokensRepository } from '../src/auth/revoked-tokens.repository';
import { TokenService } from '../src/auth/token.service';
import {
  GroupsRepository,
  UsersRepository,
  type BulkInsertStudentsResult,
  type CourseRecord,
  type CreateCourseData,
  type CreateGroupData,
  type FindGroupsFilter,
  type GroupRecord,
  type ImportGroupStudentsResult,
  type UpdateGroupData,
  type User,
  type UserSummary,
} from '../src/db';
import { setupApp } from '../src/setup-app';

// Access matrix for every HTTP route of the API: anonymous / student / lecturer / admin.
// A route missing here fails the "every route is covered" test, so new endpoints must be added.

const STUDENT: UserSummary = {
  id: '44444444-4444-4444-8444-444444444444',
  login: 'student1',
  role: 'student',
};
const LECTURER: UserSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  login: 'lecturer1',
  role: 'lecturer',
};
const OTHER_LECTURER: UserSummary = {
  id: '22222222-2222-4222-8222-222222222222',
  login: 'lecturer2',
  role: 'lecturer',
};
const ADMIN: UserSummary = {
  id: '33333333-3333-4333-8333-333333333333',
  login: 'admin1',
  role: 'admin',
};
const ALL_USERS = [STUDENT, LECTURER, OTHER_LECTURER, ADMIN];

const COURSE_ID = '66666666-6666-4666-8666-666666666666';
/** Owned by LECTURER. */
const GROUP_ID = '55555555-5555-4555-8555-555555555555';

type Actor = 'anonymous' | Role;
const ACTORS: Actor[] = ['anonymous', 'student', 'lecturer', 'admin'];
const ACTOR_USERS: Record<Role, UserSummary> = {
  student: STUDENT,
  lecturer: LECTURER,
  admin: ADMIN,
};

class InMemoryRevokedTokensRepository extends RevokedTokensRepository {
  private readonly revoked = new Set<string>();

  async revoke(jti: string): Promise<void> {
    this.revoked.add(jti);
  }

  async isRevoked(jti: string): Promise<boolean> {
    return this.revoked.has(jti);
  }
}

class FakeUsersRepository extends UsersRepository {
  private find(predicate: (user: UserSummary) => boolean): User | null {
    const user = ALL_USERS.find(predicate);
    return user ? { ...user, createdAt: new Date() } : null;
  }

  async findByLogin(login: string): Promise<User | null> {
    return this.find((user) => user.login === login);
  }

  async findById(id: string): Promise<User | null> {
    return this.find((user) => user.id === id);
  }

  async bulkInsertStudents(rawLogins: readonly string[]): Promise<BulkInsertStudentsResult> {
    return {
      createdCount: rawLogins.length,
      skippedDuplicatesCount: 0,
      createdLogins: [...rawLogins],
      skippedLogins: [],
    };
  }
}

type StoredGroup = Omit<
  GroupRecord,
  'courseName' | 'courseCode' | 'lecturerLogin' | 'studentCount'
>;

class FakeGroupsRepository extends GroupsRepository {
  private courses = new Map<string, CourseRecord>();
  private groups = new Map<string, StoredGroup>();

  reset(): void {
    const now = new Date();
    this.courses = new Map([
      [
        COURSE_ID,
        {
          id: COURSE_ID,
          name: 'Inżynieria oprogramowania',
          code: null,
          description: null,
          createdBy: ADMIN.id,
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);
    this.groups = new Map([
      [
        GROUP_ID,
        {
          id: GROUP_ID,
          courseId: COURSE_ID,
          lecturerId: LECTURER.id,
          name: 'Grupa 1',
          semester: null,
          description: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);
  }

  private hydrate(group: StoredGroup): GroupRecord {
    const course = this.courses.get(group.courseId)!;
    const lecturer = ALL_USERS.find((user) => user.id === group.lecturerId)!;
    return {
      ...group,
      courseName: course.name,
      courseCode: course.code,
      lecturerLogin: lecturer.login,
      studentCount: 0,
    };
  }

  async findUserById(id: string): Promise<UserSummary | null> {
    return ALL_USERS.find((user) => user.id === id) ?? null;
  }

  async findCourses(): Promise<CourseRecord[]> {
    return [...this.courses.values()];
  }

  async findCourseById(id: string): Promise<CourseRecord | null> {
    return this.courses.get(id) ?? null;
  }

  async createCourse(data: CreateCourseData): Promise<CourseRecord> {
    const now = new Date();
    const course = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    this.courses.set(course.id, course);
    return course;
  }

  async findGroups(filter: FindGroupsFilter = {}): Promise<GroupRecord[]> {
    return [...this.groups.values()]
      .filter(
        (group) =>
          (filter.lecturerId === undefined || group.lecturerId === filter.lecturerId) &&
          (filter.courseId === undefined || group.courseId === filter.courseId),
      )
      .map((group) => this.hydrate(group));
  }

  async findGroupById(id: string): Promise<GroupRecord | null> {
    const group = this.groups.get(id);
    return group ? this.hydrate(group) : null;
  }

  async createGroup(data: CreateGroupData): Promise<GroupRecord> {
    const now = new Date();
    const group = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    this.groups.set(group.id, group);
    return this.hydrate(group);
  }

  async updateGroup(id: string, data: UpdateGroupData): Promise<GroupRecord | null> {
    const group = this.groups.get(id);
    if (!group) {
      return null;
    }
    Object.assign(group, data, { updatedAt: new Date() });
    return this.hydrate(group);
  }

  async deleteGroup(id: string): Promise<boolean> {
    return this.groups.delete(id);
  }

  async importStudents(
    _groupId: string,
    rawLogins: readonly string[],
  ): Promise<ImportGroupStudentsResult> {
    return {
      addedLogins: [...rawLogins],
      createdLogins: [],
      alreadyInGroupLogins: [],
      notStudentLogins: [],
      duplicatesCount: 0,
    };
  }
}

interface RouteCase {
  /** Route as registered in the app, e.g. "PATCH /api/groups/:id". */
  route: string;
  /** Sends a valid request, so an allowed actor gets a success status. */
  send: (req: request.Agent) => request.Test;
  expected: Record<Actor, number>;
}

const STAFF_ONLY = { anonymous: 401, student: 403 } as const;

const ROUTES: RouteCase[] = [
  {
    route: 'GET /api/health',
    send: (r) => r.get('/api/health'),
    expected: { anonymous: 200, student: 200, lecturer: 200, admin: 200 },
  },
  {
    // Public: an empty body is rejected by validation (400), never by authorization.
    route: 'POST /api/auth/login',
    send: (r) => r.post('/api/auth/login').send({}),
    expected: { anonymous: 400, student: 400, lecturer: 400, admin: 400 },
  },
  {
    route: 'POST /api/auth/logout',
    send: (r) => r.post('/api/auth/logout'),
    expected: { anonymous: 200, student: 200, lecturer: 200, admin: 200 },
  },
  {
    route: 'GET /api/auth/me',
    send: (r) => r.get('/api/auth/me'),
    expected: { anonymous: 401, student: 200, lecturer: 200, admin: 200 },
  },
  {
    route: 'POST /api/users/import',
    send: (r) => r.post('/api/users/import').attach('file', Buffer.from('login\ns1\n'), 'u.csv'),
    expected: { ...STAFF_ONLY, lecturer: 200, admin: 200 },
  },
  {
    route: 'GET /api/courses',
    send: (r) => r.get('/api/courses'),
    expected: { ...STAFF_ONLY, lecturer: 200, admin: 200 },
  },
  {
    route: 'POST /api/courses',
    send: (r) => r.post('/api/courses').send({ name: 'Algorytmy' }),
    expected: { ...STAFF_ONLY, lecturer: 201, admin: 201 },
  },
  {
    route: 'GET /api/groups',
    send: (r) => r.get('/api/groups'),
    expected: { ...STAFF_ONLY, lecturer: 200, admin: 200 },
  },
  {
    route: 'POST /api/groups',
    send: (r) => r.post('/api/groups').send({ courseId: COURSE_ID, name: 'Grupa 2' }),
    expected: { ...STAFF_ONLY, lecturer: 201, admin: 201 },
  },
  {
    route: 'GET /api/groups/:id',
    send: (r) => r.get(`/api/groups/${GROUP_ID}`),
    expected: { ...STAFF_ONLY, lecturer: 200, admin: 200 },
  },
  {
    route: 'PATCH /api/groups/:id',
    send: (r) => r.patch(`/api/groups/${GROUP_ID}`).send({ name: 'Grupa 1A' }),
    expected: { ...STAFF_ONLY, lecturer: 200, admin: 200 },
  },
  {
    route: 'DELETE /api/groups/:id',
    send: (r) => r.delete(`/api/groups/${GROUP_ID}`),
    expected: { ...STAFF_ONLY, lecturer: 204, admin: 204 },
  },
  {
    route: 'POST /api/groups/:id/students/import',
    send: (r) =>
      r
        .post(`/api/groups/${GROUP_ID}/students/import`)
        .attach('file', Buffer.from('login\ns1\n'), 'g.csv'),
    expected: { ...STAFF_ONLY, lecturer: 200, admin: 200 },
  },
];

/** Routes acting on GROUP_ID: another lecturer must get 403, not the group. */
const OWNED_GROUP_ROUTES = [
  'GET /api/groups/:id',
  'PATCH /api/groups/:id',
  'DELETE /api/groups/:id',
  'POST /api/groups/:id/students/import',
];

interface ExpressLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

function registeredRoutes(app: INestApplication): string[] {
  const express = app.getHttpAdapter().getInstance() as { router: { stack: ExpressLayer[] } };
  return express.router.stack.flatMap(({ route }) =>
    route
      ? Object.keys(route.methods)
          .filter((method) => method !== '_all')
          .map((method) => `${method.toUpperCase()} ${route.path}`)
      : [],
  );
}

describe('Role-based access to every endpoint (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let groups: FakeGroupsRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RevokedTokensRepository)
      .useClass(InMemoryRevokedTokensRepository)
      .overrideProvider(UsersRepository)
      .useClass(FakeUsersRepository)
      .overrideProvider(GroupsRepository)
      .useClass(FakeGroupsRepository)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    tokenService = moduleRef.get(TokenService);
    groups = moduleRef.get(GroupsRepository) as FakeGroupsRepository;
  });

  beforeEach(() => {
    groups.reset();
  });

  afterAll(async () => {
    await app?.close();
  });

  function cookieFor(user: UserSummary): string {
    const token = tokenService.signAccessToken({
      userId: user.id,
      login: user.login,
      role: user.role,
    });
    return `${AUTH_COOKIE_NAME}=${token}`;
  }

  function sendAs(actor: Actor | UserSummary, routeCase: RouteCase): request.Test {
    const req = routeCase.send(request.agent(app.getHttpServer()));
    if (actor === 'anonymous') {
      return req;
    }
    const user = typeof actor === 'string' ? ACTOR_USERS[actor] : actor;
    return req.set('Cookie', cookieFor(user));
  }

  function routeCase(route: string): RouteCase {
    const found = ROUTES.find((r) => r.route === route);
    if (!found) {
      throw new Error(`No access case for ${route}`);
    }
    return found;
  }

  it('covers every route registered in the app', () => {
    const covered = ROUTES.map((r) => r.route).sort();

    expect(registeredRoutes(app).sort()).toEqual(covered);
  });

  describe.each(ROUTES)('$route', (routeCase) => {
    it.each(ACTORS)('%s', async (actor) => {
      await sendAs(actor, routeCase).expect(routeCase.expected[actor]);
    });
  });

  describe('group of another lecturer', () => {
    it.each(OWNED_GROUP_ROUTES)('%s returns 403 to a lecturer who does not own it', async (r) => {
      await sendAs(OTHER_LECTURER, routeCase(r)).expect(403);
      expect(await groups.findGroupById(GROUP_ID)).toEqual(
        expect.objectContaining({ name: 'Grupa 1' }),
      );
    });

    it('is not listed for a lecturer who does not own it', async () => {
      const res = await sendAs(OTHER_LECTURER, routeCase('GET /api/groups')).expect(200);

      expect(res.body).toEqual([]);
    });

    it('cannot be created for another lecturer by a lecturer', async () => {
      await request(app.getHttpServer())
        .post('/api/groups')
        .set('Cookie', cookieFor(OTHER_LECTURER))
        .send({ courseId: COURSE_ID, name: 'Grupa 3', lecturerId: LECTURER.id })
        .expect(403);
    });
  });

  describe('invalid sessions on a staff-only route', () => {
    const coursesRoute = () => request(app.getHttpServer()).get('/api/courses');

    it('rejects a student token with the role changed to admin', async () => {
      const token = cookieFor(STUDENT).slice(AUTH_COOKIE_NAME.length + 1);
      const [header, payload, signature] = token.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as object;
      const forgedPayload = Buffer.from(JSON.stringify({ ...claims, role: 'admin' })).toString(
        'base64url',
      );

      await coursesRoute()
        .set('Cookie', `${AUTH_COOKIE_NAME}=${header}.${forgedPayload}.${signature}`)
        .expect(401);
    });

    it('rejects an admin token signed with another secret', async () => {
      const token = jwt.sign({ login: ADMIN.login, role: 'admin' }, 'not-the-server-secret!!', {
        algorithm: 'HS256',
        subject: ADMIN.id,
        jwtid: randomUUID(),
        expiresIn: 60,
      });

      await coursesRoute().set('Cookie', `${AUTH_COOKIE_NAME}=${token}`).expect(401);
    });

    it('rejects an expired admin token', async () => {
      const token = jwt.sign({ login: ADMIN.login, role: 'admin' }, getJwtSecret(), {
        algorithm: 'HS256',
        subject: ADMIN.id,
        jwtid: randomUUID(),
        expiresIn: -10,
      });

      await coursesRoute().set('Cookie', `${AUTH_COOKIE_NAME}=${token}`).expect(401);
    });

    it('rejects an admin token after logout', async () => {
      const cookie = cookieFor(ADMIN);
      await coursesRoute().set('Cookie', cookie).expect(200);

      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(200);

      await coursesRoute().set('Cookie', cookie).expect(401);
    });
  });
});
