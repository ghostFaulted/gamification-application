export const ROLES = ['student', 'lecturer', 'admin'] as const;

export type Role = (typeof ROLES)[number];
