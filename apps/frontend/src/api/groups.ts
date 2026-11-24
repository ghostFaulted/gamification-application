import type { GroupDto, GroupStudentDto, GroupStudentsImportReport } from '@gamification/shared';
import { ApiError, apiFetch } from './client';
import { ImportError, translateImportMessage } from './users';

/**
 * Groups visible to the signed-in user (GET /api/groups): a lecturer gets only their own
 * groups, an admin gets all of them. Throws ApiError (e.g. 403 for a student).
 */
export function fetchGroups(signal?: AbortSignal): Promise<GroupDto[]> {
  return apiFetch<GroupDto[]>('/api/groups', { signal });
}

/**
 * One group with its course and student count (GET /api/groups/:id). A lecturer may read only
 * their own groups, an admin any group. Throws ApiError: 400 (malformed id), 403 (someone
 * else's group), 404 (no such group).
 */
export function fetchGroup(id: string, signal?: AbortSignal): Promise<GroupDto> {
  return apiFetch<GroupDto>(`/api/groups/${encodeURIComponent(id)}`, { signal });
}

/** Students of a group (GET /api/groups/:id/students); same access rules as fetchGroup. */
export function fetchGroupStudents(id: string, signal?: AbortSignal): Promise<GroupStudentDto[]> {
  return apiFetch<GroupStudentDto[]>(`/api/groups/${encodeURIComponent(id)}/students`, {
    signal,
  });
}

/**
 * Adds the students from a CSV file to a group (POST /api/groups/:id/students/import).
 * Throws ImportError with a Polish message; a 401 is handled by apiFetch (session expired).
 */
export async function importGroupStudents(
  id: string,
  file: File,
): Promise<GroupStudentsImportReport> {
  const body = new FormData();
  body.append('file', file);

  try {
    const report = await apiFetch<GroupStudentsImportReport>(
      `/api/groups/${encodeURIComponent(id)}/students/import`,
      { method: 'POST', body },
    );
    return {
      ...report,
      errors: report.errors.map((e) => ({ ...e, reason: translateImportMessage(e.reason) })),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) throw new ImportError('Ta grupa już nie istnieje.');
      if (error.status === 403) throw new ImportError('Brak uprawnień do importu do tej grupy.');
      throw new ImportError(translateImportMessage(error.message));
    }
    throw error;
  }
}
