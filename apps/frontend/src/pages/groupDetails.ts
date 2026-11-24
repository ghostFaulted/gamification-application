import type { GroupDto, GroupStudentsImportReport } from '@gamification/shared';
import { ApiError } from '../api/client';

const GROUP_LOAD_FAILED = 'Nie udało się pobrać danych grupy. Spróbuj ponownie.';

/** Why the group could not be shown; "not-found" and "forbidden" get their own message. */
export type GroupLoadError =
  { kind: 'not-found' } | { kind: 'forbidden' } | { kind: 'failed'; message: string };

/**
 * 404 (no such group) and 400 (malformed id in the URL) both mean "this group does not exist";
 * 403 means it belongs to another lecturer. Anything else can be retried.
 */
export function toGroupLoadError(error: unknown): GroupLoadError {
  if (error instanceof ApiError) {
    if (error.status === 404 || error.status === 400) return { kind: 'not-found' };
    if (error.status === 403) return { kind: 'forbidden' };
    // 5xx messages from the server are English internals; status 0 already has a Polish one.
    if (error.status < 500) return { kind: 'failed', message: error.message };
  }
  return { kind: 'failed', message: GROUP_LOAD_FAILED };
}

/** "Programowanie obiektowe (PO) · zimowy 2026/2027 · 6 studentów". */
export function groupMeta(group: GroupDto): string {
  const course = group.courseCode ? `${group.courseName} (${group.courseCode})` : group.courseName;
  return [course, group.semester, studentCountLabel(group.studentCount)]
    .filter(Boolean)
    .join(' · ');
}

export function studentCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'student' : 'studentów'}`;
}

/**
 * Toast text after a group import, e.g. "Zaimportowano 6 studentów." plus what was skipped:
 * students already in the group, staff accounts and rejected rows.
 */
export function importSummary(report: GroupStudentsImportReport): string {
  const parts = [
    report.added > 0
      ? `Zaimportowano ${report.added} ${report.added === 1 ? 'studenta' : 'studentów'}.`
      : 'Nie dodano nowych studentów.',
  ];
  if (report.alreadyInGroup > 0) parts.push(`Już w grupie: ${report.alreadyInGroup}.`);
  if (report.notStudentLogins.length > 0) {
    parts.push(`Pominięte konta prowadzących: ${report.notStudentLogins.length}.`);
  }
  if (report.invalid > 0) parts.push(`Błędne wiersze: ${report.invalid}.`);
  return parts.join(' ');
}
