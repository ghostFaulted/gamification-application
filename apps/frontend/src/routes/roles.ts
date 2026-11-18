import type { Role } from '@gamification/shared';

/** Roles allowed to import students from CSV (same as RolesGuard on POST /api/users/import). */
export const IMPORT_ROLES: readonly Role[] = ['lecturer', 'admin'];

/** Start page of each role; the user lands here after signing in. */
export const ROLE_HOME: Record<Role, string> = {
  student: '/student',
  lecturer: '/lecturer',
  admin: '/admin',
};

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  lecturer: 'Prowadzący',
  admin: 'Administrator',
};
