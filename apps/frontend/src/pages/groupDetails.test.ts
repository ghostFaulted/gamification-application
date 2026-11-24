// @vitest-environment jsdom
import type { GroupDto, GroupStudentsImportReport } from '@gamification/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { groupMeta, importSummary, studentCountLabel, toGroupLoadError } from './groupDetails';

const group: GroupDto = {
  id: '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f',
  courseId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  courseName: 'Programowanie obiektowe',
  courseCode: 'PO',
  lecturerId: '9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b',
  lecturerLogin: 'lecturer1',
  name: 'Programowanie obiektowe – gr. 2',
  semester: 'zimowy 2026/2027',
  description: null,
  studentCount: 6,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

describe('toGroupLoadError', () => {
  it('treats 404 and a malformed id (400) as a missing group', () => {
    expect(toGroupLoadError(new ApiError(404, 'Group not found'))).toEqual({ kind: 'not-found' });
    expect(toGroupLoadError(new ApiError(400, 'id must be a valid UUID'))).toEqual({
      kind: 'not-found',
    });
  });

  it("treats 403 as someone else's group", () => {
    expect(toGroupLoadError(new ApiError(403, 'Forbidden'))).toEqual({ kind: 'forbidden' });
  });

  it('keeps the message of other API errors so they can be retried', () => {
    expect(toGroupLoadError(new ApiError(0, 'Brak połączenia z serwerem.'))).toEqual({
      kind: 'failed',
      message: 'Brak połączenia z serwerem.',
    });
  });

  it('replaces server error (5xx) messages with a Polish one', () => {
    expect(toGroupLoadError(new ApiError(500, 'Internal server error'))).toEqual({
      kind: 'failed',
      message: 'Nie udało się pobrać danych grupy. Spróbuj ponownie.',
    });
  });

  it('uses a generic message for unexpected errors', () => {
    expect(toGroupLoadError(new TypeError('boom'))).toEqual({
      kind: 'failed',
      message: 'Nie udało się pobrać danych grupy. Spróbuj ponownie.',
    });
  });
});

describe('groupMeta', () => {
  it('joins course with code, semester and student count', () => {
    expect(groupMeta(group)).toBe('Programowanie obiektowe (PO) · zimowy 2026/2027 · 6 studentów');
  });

  it('uses the given student count (the fetched list) instead of studentCount', () => {
    expect(groupMeta({ ...group, studentCount: 6 }, 7)).toBe(
      'Programowanie obiektowe (PO) · zimowy 2026/2027 · 7 studentów',
    );
  });

  it('skips a missing course code and semester', () => {
    expect(groupMeta({ ...group, courseCode: null, semester: null, studentCount: 1 })).toBe(
      'Programowanie obiektowe · 1 student',
    );
  });
});

describe('studentCountLabel', () => {
  it('uses the singular only for one student', () => {
    expect(studentCountLabel(0)).toBe('0 studentów');
    expect(studentCountLabel(1)).toBe('1 student');
    expect(studentCountLabel(28)).toBe('28 studentów');
  });
});

describe('importSummary', () => {
  const empty: GroupStudentsImportReport = {
    added: 0,
    addedLogins: [],
    createdAccounts: 0,
    createdLogins: [],
    alreadyInGroup: 0,
    alreadyInGroupLogins: [],
    notStudentLogins: [],
    duplicatesInFile: 0,
    invalid: 0,
    errors: [],
  };

  it('matches the Figma toast for a plain import', () => {
    expect(importSummary({ ...empty, added: 6 })).toBe('Zaimportowano 6 studentów.');
    expect(importSummary({ ...empty, added: 1 })).toBe('Zaimportowano 1 studenta.');
  });

  it('lists what was skipped', () => {
    expect(
      importSummary({
        ...empty,
        alreadyInGroup: 3,
        notStudentLogins: ['lecturer2'],
        duplicatesInFile: 4,
        invalid: 2,
      }),
    ).toBe(
      'Nie dodano nowych studentów. Już w grupie: 3. Pominięte konta prowadzących: 1. Duplikaty w pliku: 4. Błędne wiersze: 2.',
    );
  });

  it('omits duplicates when there are none', () => {
    expect(importSummary({ ...empty, added: 2, duplicatesInFile: 0 })).toBe(
      'Zaimportowano 2 studentów.',
    );
    expect(importSummary({ ...empty, added: 2, duplicatesInFile: 1 })).toBe(
      'Zaimportowano 2 studentów. Duplikaty w pliku: 1.',
    );
  });
});
