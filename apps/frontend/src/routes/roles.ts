import type { Role } from '@gamification/shared';

/** Roles allowed to import students from CSV (same as RolesGuard on POST /api/users/import). */
export const IMPORT_ROLES: readonly Role[] = ['lecturer', 'admin'];

/** Start page of each role; the user lands here after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  student: '/student',
  lecturer: '/lecturer',
  admin: '/admin',
};

/** Group create/edit form routes (SCRUM-77). */
export const GROUP_NEW_PATH = '/lecturer/groups/new';

export function groupEditPath(groupId: string): string {
  return `/lecturer/groups/${encodeURIComponent(groupId)}/edit`;
}

/** CSV import into one group (POST /api/groups/:id/students/import, SCRUM-75). */
export function groupImportPath(groupId: string): string {
  return `/lecturer/groups/${encodeURIComponent(groupId)}/import`;
}

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  lecturer: 'Prowadzący',
  admin: 'Administrator',
};
