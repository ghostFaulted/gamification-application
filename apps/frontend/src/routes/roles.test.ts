import { describe, expect, it } from 'vitest';
import { GROUPS_LIST_PATH, groupEditPath, groupImportPath, groupPath } from './roles';

describe('group paths', () => {
  const id = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f';

  it('points the group view at /lecturer/groups/:id, consistent with create, edit and import', () => {
    expect(GROUPS_LIST_PATH).toBe('/lecturer');
    expect(groupPath(id)).toBe(`/lecturer/groups/${id}`);
    expect(groupEditPath(id)).toBe(`/lecturer/groups/${id}/edit`);
    expect(groupImportPath(id)).toBe(`/lecturer/groups/${id}/import`);
  });

  it('encodes the group id in every path helper', () => {
    expect(groupPath('a/b')).toBe('/lecturer/groups/a%2Fb');
    expect(groupEditPath('a/b')).toBe('/lecturer/groups/a%2Fb/edit');
    expect(groupImportPath('a/b')).toBe('/lecturer/groups/a%2Fb/import');
  });
});
