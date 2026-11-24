import type { UsersImportRowError } from './users-import.js';

export interface CourseDto {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCourseRequest {
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface GroupDto {
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupRequest {
  courseId: string;
  name: string;
  semester?: string | null;
  description?: string | null;
  /** Allowed only for admins; lecturers are always assigned as the owner. */
  lecturerId?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  semester?: string | null;
  description?: string | null;
}

/** Response body of POST /api/groups/:id/students/import. Logins are lowercased, in file order. */
export interface GroupStudentsImportReport {
  /** Students added to the group by this import. */
  added: number;
  addedLogins: string[];
  /** Student accounts created by this import (all of them are also in `addedLogins`). */
  createdAccounts: number;
  createdLogins: string[];
  /** Students that were already in the group; nothing changed for them. */
  alreadyInGroup: number;
  alreadyInGroupLogins: string[];
  /** Lecturer or admin accounts listed in the file; they are never added as students. */
  notStudentLogins: string[];
  /** Extra occurrences of a login repeated in the file. */
  duplicatesInFile: number;
  /** Rows rejected by validation, listed in `errors`. */
  invalid: number;
  errors: UsersImportRowError[];
}

/** One student of a group, as returned by GET /api/groups/:id/students. */
export interface GroupStudentDto {
  /** User id of the student. */
  id: string;
  login: string;
  /** ISO timestamp of adding the student to the group. */
  assignedAt: string;
}
