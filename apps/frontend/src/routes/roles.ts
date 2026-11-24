import type { Role } from '@gamification/shared';

/** Roles allowed to import students from CSV (same as RolesGuard on POST /api/users/import). */
export const IMPORT_ROLES: readonly Role[] = ['lecturer', 'admin'];

/** Start page of each role; the user lands here after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  student: '/student',
  lecturer: '/lecturer',
  admin: '/admin',
};

/** Group form routes (SCRUM-77); until then they show a placeholder. */
export const GROUP_NEW_PATH = '/lecturer/groups/new';

export function groupEditPath(groupId: string): string {
  return `/lecturer/groups/${encodeURIComponent(groupId)}/edit`;
}

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  lecturer: 'Prowadzący',
  admin: 'Administrator',
};

/** Roles allowed to open a group's details (same as @Auth on GET /api/groups/:id). */
export const GROUP_VIEW_ROLES: readonly Role[] = ['lecturer', 'admin'];

/** Path of the group view (SCRUM-78), e.g. for a link from the group list. */
export function groupPath(groupId: string): string {
  return `/groups/${encodeURIComponent(groupId)}`;
}
