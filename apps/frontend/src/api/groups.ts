import type { GroupDto } from '@gamification/shared';
import { apiFetch } from './client';

/**
 * Groups visible to the signed-in user (GET /api/groups): a lecturer gets only their own
 * groups, an admin gets all of them. Throws ApiError (e.g. 403 for a student).
 */
export function fetchGroups(signal?: AbortSignal): Promise<GroupDto[]> {
  return apiFetch<GroupDto[]>('/api/groups', { signal });
}
