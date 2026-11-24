// @vitest-environment jsdom
import type { AuthUser, GroupDto } from '@gamification/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { GroupStudentsTable } from '../components/GroupStudentsTable';
import { GroupDetailsPage } from './GroupDetailsPage';

const GROUP_ID = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f';

const group: GroupDto = {
  id: GROUP_ID,
  courseId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  courseName: 'Programowanie obiektowe',
  courseCode: 'PO',
  lecturerId: '9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b',
  lecturerLogin: 'lecturer1',
  name: 'Programowanie obiektowe – gr. 2',
  semester: 'zimowy 2026/2027',
  description: null,
  studentCount: 6,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(user: AuthUser = { login: 'lecturer1', role: 'lecturer' }) {
  const auth = { user } as AuthContextValue;
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <GroupDetailsPage groupId={GROUP_ID} />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GroupDetailsPage', () => {
  it('loads the group through GET /api/groups/:id and shows its header', async () => {
    const fetchMock = mockFetch(jsonResponse(200, group));
    renderPage();

    expect(screen.getByRole('status').textContent).toContain('Ładowanie grupy');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Programowanie obiektowe – gr. 2' }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(`/api/groups/${GROUP_ID}`, expect.anything());
    expect(
      screen.getByText('Programowanie obiektowe (PO) · zimowy 2026/2027 · 6 studentów'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Lista studentów (6)' })).toBeTruthy();

    const breadcrumb = screen.getByRole('navigation', { name: 'Ścieżka' });
    const groupsLink = within(breadcrumb).getByRole('link', { name: 'Moje grupy' });
    expect(groupsLink.getAttribute('href')).toBe('/lecturer');
    expect(within(breadcrumb).getByText(group.name).getAttribute('aria-current')).toBe('page');
  });

  it('shows the empty state for a group without students', async () => {
    mockFetch(jsonResponse(200, { ...group, studentCount: 0 }));
    renderPage();

    expect(await screen.findByText('Brak studentów w grupie')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Lista studentów (0)' })).toBeTruthy();
  });

  it('shows a readable message for a missing group (404)', async () => {
    mockFetch(jsonResponse(404, { statusCode: 404, message: 'Group not found' }));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Nie znaleziono grupy' })).toBeTruthy();
    const back = screen.getByRole('link', { name: 'Wróć do listy grup' });
    expect(back.getAttribute('href')).toBe('/lecturer');
  });

  it('treats a malformed id (400) like a missing group', async () => {
    mockFetch(jsonResponse(400, { statusCode: 400, message: 'id must be a valid UUID' }));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Nie znaleziono grupy' })).toBeTruthy();
  });

  it("shows a readable message for another lecturer's group (403)", async () => {
    mockFetch(jsonResponse(403, { statusCode: 403, message: 'Forbidden' }));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Brak dostępu do tej grupy' })).toBeTruthy();
  });

  it('lets the user retry after a server error', async () => {
    const fetchMock = mockFetch(
      jsonResponse(500, { statusCode: 500, message: 'Internal server error' }),
      jsonResponse(200, group),
    );
    renderPage();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Nie udało się pobrać danych grupy.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByRole('heading', { level: 1, name: group.name })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('links "Moje grupy" to the start page of an admin', async () => {
    mockFetch(jsonResponse(200, group));
    renderPage({ login: 'admin1', role: 'admin' });

    await screen.findByRole('heading', { level: 1, name: group.name });
    expect(screen.getByRole('link', { name: 'Moje grupy' }).getAttribute('href')).toBe('/admin');
  });
});

describe('GroupStudentsTable', () => {
  it('numbers the students and shows when each one was added', () => {
    render(
      <GroupStudentsTable
        students={[
          { login: 's500001', assignedAt: '2026-11-18T10:00:00.000Z' },
          { login: 's500002', assignedAt: '2026-11-18T10:00:00.000Z' },
        ]}
      />,
    );

    const rows = screen.getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Lp.LoginStatus',
      '1s500001Dodany 18.11.2026',
      '2s500002Dodany 18.11.2026',
    ]);
  });
});
