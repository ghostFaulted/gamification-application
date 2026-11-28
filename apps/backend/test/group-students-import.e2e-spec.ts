import type { INestApplication } from '@nestjs/common';
import type { Role } from '@gamification/shared';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME } from '../src/auth/auth.constants';
import { RevokedTokensRepository } from '../src/auth/revoked-tokens.repository';
import { TokenService } from '../src/auth/token.service';
import {
  GroupNotFoundError,
  GroupsRepository,
  type GroupRecord,
  type ImportGroupStudentsResult,
} from '../src/db';
import { setupApp } from '../src/setup-app';

const LECTURER_1 = { id: '11111111-1111-4111-8111-111111111111', login: 'lecturer1' };
const LECTURER_2 = { id: '22222222-2222-4222-8222-222222222222', login: 'lecturer2' };
const ADMIN_1 = { id: '33333333-3333-4333-8333-333333333333', login: 'admin1' };
const STUDENT_1 = { id: '44444444-4444-4444-8444-444444444444', login: 'student1' };
const GROUP_ID = '55555555-5555-4555-8555-555555555555';
const MISSING_GROUP_ID = '99999999-9999-4999-8999-999999999999';

class NoRevokedTokensRepository extends RevokedTokensRepository {
  async revoke(): Promise<void> {}

  async isRevoked(): Promise<boolean> {
    return false;
  }
}

class FakeGroupsRepository extends GroupsRepository {
  importCalls: Array<{ groupId: string; logins: string[] }> = [];
  deletedDuringImport = false;

  async findGroupById(id: string): Promise<GroupRecord | null> {
    if (id !== GROUP_ID) {
      return null;
    }
    const now = new Date();
    return {
      id: GROUP_ID,
      courseId: '66666666-6666-4666-8666-666666666666',
      courseName: 'Inżynieria oprogramowania',
      courseCode: null,
      lecturerId: LECTURER_1.id,
      lecturerLogin: LECTURER_1.login,
      name: 'Grupa 1',
      semester: null,
      description: null,
      studentCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async importStudents(
    groupId: string,
    logins: readonly string[],
  ): Promise<ImportGroupStudentsResult> {
    this.importCalls.push({ groupId, logins: [...logins] });
    if (this.deletedDuringImport) {
      throw new GroupNotFoundError();
    }
    return {
      addedLogins: ['s1', 's2'],
      createdLogins: ['s2'],
      alreadyInGroupLogins: ['s3'],
      notStudentLogins: ['lecturer2'],
      duplicatesCount: 1,
    };
  }

  findUserById(): never {
    throw new Error('Not used in these tests');
  }
  findCourses(): never {
    throw new Error('Not used in these tests');
  }
  findCourseById(): never {
    throw new Error('Not used in these tests');
  }
  createCourse(): never {
    throw new Error('Not used in these tests');
  }
  findGroups(): never {
    throw new Error('Not used in these tests');
  }
  createGroup(): never {
    throw new Error('Not used in these tests');
  }
  updateGroup(): never {
    throw new Error('Not used in these tests');
  }
  deleteGroup(): never {
    throw new Error('Not used in these tests');
  }
  findGroupStudents(): never {
    throw new Error('Not used in these tests');
  }
  findGroupCatalog(): never {
    throw new Error('Not used in these tests');
  }
}

describe('POST /api/groups/:id/students/import (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let repository: FakeGroupsRepository;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RevokedTokensRepository)
      .useClass(NoRevokedTokensRepository)
      .overrideProvider(GroupsRepository)
      .useClass(FakeGroupsRepository)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    tokenService = moduleRef.get(TokenService);
    repository = moduleRef.get(GroupsRepository) as FakeGroupsRepository;
  });

  beforeEach(() => {
    repository.importCalls = [];
    repository.deletedDuringImport = false;
  });

  afterAll(async () => {
    await app?.close();
  });

  function importAs(user: { id: string; login: string }, role: Role, groupId = GROUP_ID) {
    const token = tokenService.signAccessToken({ userId: user.id, login: user.login, role });
    return request(app.getHttpServer())
      .post(`/api/groups/${groupId}/students/import`)
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);
  }

  const csv = () => Buffer.from('login;name\ns1;Jan\nS2;Anna\nbad login;Ola\ns3;Piotr\n');

  it('returns 401 without a session', async () => {
    await request(app.getHttpServer())
      .post(`/api/groups/${GROUP_ID}/students/import`)
      .attach('file', csv(), 'students.csv')
      .expect(401);
  });

  it('returns 403 for a student', async () => {
    await importAs(STUDENT_1, 'student').attach('file', csv(), 'students.csv').expect(403);
    expect(repository.importCalls).toEqual([]);
  });

  it('returns 403 for a lecturer importing into another lecturer group, before reading the CSV', async () => {
    await importAs(LECTURER_2, 'lecturer')
      .attach('file', Buffer.from('not a csv'), 'students.txt')
      .expect(403);
    expect(repository.importCalls).toEqual([]);
  });

  it('returns 403 for another lecturer group before multer limits apply', async () => {
    await importAs(LECTURER_2, 'lecturer')
      .field('note', 'extra')
      .attach('file', csv(), 'students.csv')
      .expect(403);
    expect(repository.importCalls).toEqual([]);
  });

  it('returns 404 for an unknown group before multer limits apply', async () => {
    await importAs(ADMIN_1, 'admin', MISSING_GROUP_ID)
      .field('note', 'extra')
      .attach('file', csv(), 'students.csv')
      .expect(404);
  });

  it('returns 404 for an unknown group', async () => {
    await importAs(ADMIN_1, 'admin', MISSING_GROUP_ID)
      .attach('file', csv(), 'students.csv')
      .expect(404);
  });

  it('returns 400 for an invalid group id', async () => {
    await importAs(ADMIN_1, 'admin', 'not-a-uuid')
      .attach('file', csv(), 'students.csv')
      .expect(400);
  });

  it('imports into the lecturer own group and returns the report', async () => {
    const res = await importAs(LECTURER_1, 'lecturer')
      .attach('file', csv(), 'students.csv')
      .expect(200);

    expect(repository.importCalls).toEqual([{ groupId: GROUP_ID, logins: ['s1', 's2', 's3'] }]);
    expect(res.body).toEqual({
      added: 2,
      addedLogins: ['s1', 's2'],
      createdAccounts: 1,
      createdLogins: ['s2'],
      alreadyInGroup: 1,
      alreadyInGroupLogins: ['s3'],
      notStudentLogins: ['lecturer2'],
      duplicatesInFile: 1,
      invalid: 1,
      errors: [{ row: 4, value: 'bad login', reason: 'Login contains invalid characters' }],
    });
  });

  it('lets an admin import into any group', async () => {
    await importAs(ADMIN_1, 'admin').attach('file', csv(), 'students.csv').expect(200);
    expect(repository.importCalls).toHaveLength(1);
  });

  it('returns 404 when the group is deleted during the import', async () => {
    repository.deletedDuringImport = true;

    await importAs(LECTURER_1, 'lecturer').attach('file', csv(), 'students.csv').expect(404);
  });

  it('returns 400 when no file is sent', async () => {
    const res = await importAs(LECTURER_1, 'lecturer').expect(400);

    expect(res.body.message).toBe('CSV file is required');
    expect(repository.importCalls).toEqual([]);
  });

  it('returns 400 for a non-file multipart field', async () => {
    const res = await importAs(LECTURER_1, 'lecturer')
      .field('note', 'extra')
      .attach('file', csv(), 'students.csv')
      .expect(400);

    expect(res.body.message).toBe('Too many fields');
    expect(repository.importCalls).toEqual([]);
  });

  it('returns 400 for a malformed CSV', async () => {
    await importAs(LECTURER_1, 'lecturer')
      .attach('file', Buffer.from('user\ns1\n'), 'students.csv')
      .expect(400);
    expect(repository.importCalls).toEqual([]);
  });
});
