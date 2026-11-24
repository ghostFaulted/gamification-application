import type { GroupDto, GroupStudentsImportReport } from '@gamification/shared';
import { ApiError, apiFetch } from './client';
import { ImportError, translateImportMessage } from './users';

/**
 * Groups visible to the signed-in user (GET /api/groups): a lecturer gets only their own
 * groups, an admin gets all of them. Throws ApiError (e.g. 403 for a student).
 */
export function fetchGroups(signal?: AbortSignal): Promise<GroupDto[]> {
  return apiFetch<GroupDto[]>('/api/groups', { signal });
}

/** One group (GET /api/groups/:id); 403 for someone else's group, 404 for a missing one. */
export function fetchGroup(groupId: string, signal?: AbortSignal): Promise<GroupDto> {
  return apiFetch<GroupDto>(`/api/groups/${encodeURIComponent(groupId)}`, { signal });
}

/** Polish message for a failed request about a single group (403/404/400 for a bad id). */
export function groupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Nie masz dostępu do tej grupy.';
    if (error.status === 404) return 'Grupa nie istnieje lub została usunięta.';
    if (error.status === 400 && /\bid\b/i.test(error.message)) return 'Nieprawidłowy adres grupy.';
    return translateImportMessage(error.message);
  }
  return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
}

/**
 * Sends the file to POST /api/groups/:id/students/import (SCRUM-75): creates missing student
 * accounts and adds them to the group. Throws ImportError with a Polish message.
 */
export async function importGroupStudents(
  groupId: string,
  file: File,
): Promise<GroupStudentsImportReport> {
  const body = new FormData();
  body.append('file', file);

  try {
    const report = await apiFetch<GroupStudentsImportReport>(
      `/api/groups/${encodeURIComponent(groupId)}/students/import`,
      { method: 'POST', body },
    );
    return {
      ...report,
      errors: report.errors.map((e) => ({ ...e, reason: translateImportMessage(e.reason) })),
    };
  } catch (error) {
    if (error instanceof ApiError) throw new ImportError(groupErrorMessage(error));
    throw error;
  }
}
