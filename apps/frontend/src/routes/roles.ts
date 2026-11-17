import type { Role } from '@gamification/shared';

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
