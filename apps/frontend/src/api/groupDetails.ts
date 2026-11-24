import type { GroupDto } from '@gamification/shared';
import { apiFetch } from './client';

/**
 * One group with its course and student count (GET /api/groups/:id). A lecturer may read only
 * their own groups, an admin any group. Throws ApiError: 400 (malformed id), 403 (someone
 * else's group), 404 (no such group).
 */
export function fetchGroup(id: string, signal?: AbortSignal): Promise<GroupDto> {
  return apiFetch<GroupDto>(`/api/groups/${encodeURIComponent(id)}`, { signal });
}
