// @vitest-environment jsdom
import type {
  AuthUser,
  GroupDto,
  GroupStudentDto,
  GroupStudentsImportReport,
} from '@gamification/shared';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/AuthContext';
import { GroupDetailsPage } from './GroupDetailsPage';

const GROUP_ID = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f';
const GROUP_URL = `/api/groups/${GROUP_ID}`;
const STUDENTS_URL = `${GROUP_URL}/students`;
const IMPORT_URL = `${STUDENTS_URL}/import`;

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
  studentCount: 2,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

function student(n: number): GroupStudentDto {
  return { id: `id-${n}`, login: `s50000${n}`, assignedAt: '2026-11-18T10:00:00.000Z' };
}

const report: GroupStudentsImportReport = {
  added: 1,
  addedLogins: ['s500003'],
  createdAccounts: 1,
  createdLogins: ['s500003'],
  alreadyInGroup: 2,
  alreadyInGroupLogins: ['s500001', 's500002'],
  notStudentLogins: [],
  duplicatesInFile: 0,
  invalid: 0,
  errors: [],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Handler = () => Response | Promise<Response>;

/** Answers fetch by "METHOD url"; each handler list is used in order, the last one repeats. */
function mockApi(routes: Record<string, Handler[]>) {
  const used: Record<string, number> = {};
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handlers = routes[key];
    if (!handlers) throw new Error(`Unexpected request ${key}`);
    const index = Math.min(used[key] ?? 0, handlers.length - 1);
    used[key] = (used[key] ?? 0) + 1;
    return handlers[index]();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function okGroup(
  students: GroupStudentDto[] = [student(1), student(2)],
): Record<string, Handler[]> {
  return {
    [`GET ${GROUP_URL}`]: [() => jsonResponse(200, { ...group, studentCount: students.length })],
    [`GET ${STUDENTS_URL}`]: [() => jsonResponse(200, students)],
  };
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

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('Plik CSV ze studentami'), { target: { files: [file] } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GroupDetailsPage', () => {
  it('loads the group and its students and shows them in the table', async () => {
    const fetchMock = mockApi(okGroup());
    renderPage();

    expect(screen.getByRole('status').textContent).toContain('Ładowanie grupy');
    expect(await screen.findByRole('heading', { level: 1, name: group.name })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(GROUP_URL, expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(STUDENTS_URL, expect.anything());
    expect(
      screen.getByText('Programowanie obiektowe (PO) · zimowy 2026/2027 · 2 studentów'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Lista studentów (2)' })).toBeTruthy();
    expect(screen.getAllByRole('row').map((row) => row.textContent)).toEqual([
      'Lp.LoginStatus',
      '1s500001Dodany 18.11.2026',
      '2s500002Dodany 18.11.2026',
    ]);

    const breadcrumb = screen.getByRole('navigation', { name: 'Ścieżka' });
    const groupsLink = within(breadcrumb).getByRole('link', { name: 'Moje grupy' });
    expect(groupsLink.getAttribute('href')).toBe('/lecturer');
    expect(within(breadcrumb).getByText(group.name).getAttribute('aria-current')).toBe('page');
  });

  it('counts students in the header from the fetched list, not the stale studentCount', async () => {
    mockApi({
      [`GET ${GROUP_URL}`]: [() => jsonResponse(200, { ...group, studentCount: 5 })],
      [`GET ${STUDENTS_URL}`]: [() => jsonResponse(200, [student(1), student(2), student(3)])],
    });
    renderPage();

    expect(
      await screen.findByText('Programowanie obiektowe (PO) · zimowy 2026/2027 · 3 studentów'),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Lista studentów (3)' })).toBeTruthy();
  });

  it('shows the empty state for a group without students', async () => {
    mockApi(okGroup([]));
    renderPage();

    expect(await screen.findByText('Brak studentów w grupie')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Lista studentów (0)' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a readable message for a missing group (404)', async () => {
    mockApi({
      [`GET ${GROUP_URL}`]: [() => jsonResponse(404, { statusCode: 404, message: 'Not found' })],
      [`GET ${STUDENTS_URL}`]: [() => jsonResponse(404, { statusCode: 404, message: 'Not found' })],
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Nie znaleziono grupy' })).toBeTruthy();
    const back = screen.getByRole('link', { name: 'Wróć do listy grup' });
    expect(back.getAttribute('href')).toBe('/lecturer');
  });

  it('treats a malformed id (400) like a missing group', async () => {
    mockApi({
      [`GET ${GROUP_URL}`]: [() => jsonResponse(400, { statusCode: 400, message: 'Bad id' })],
      [`GET ${STUDENTS_URL}`]: [() => jsonResponse(400, { statusCode: 400, message: 'Bad id' })],
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Nie znaleziono grupy' })).toBeTruthy();
  });

  it("shows a readable message for another lecturer's group (403)", async () => {
    mockApi({
      [`GET ${GROUP_URL}`]: [() => jsonResponse(403, { statusCode: 403, message: 'Forbidden' })],
      [`GET ${STUDENTS_URL}`]: [() => jsonResponse(403, { statusCode: 403, message: 'Forbidden' })],
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Brak dostępu do tej grupy' })).toBeTruthy();
  });

  it('lets the user retry after a server error', async () => {
    const routes = okGroup();
    routes[`GET ${STUDENTS_URL}`] = [
      () => jsonResponse(500, { statusCode: 500, message: 'Internal server error' }),
      () => jsonResponse(200, [student(1)]),
    ];
    mockApi(routes);
    renderPage();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Nie udało się pobrać danych grupy.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByRole('heading', { name: 'Lista studentów (1)' })).toBeTruthy();
  });

  it('links "Moje grupy" to the start page of an admin', async () => {
    mockApi(okGroup());
    renderPage({ login: 'admin1', role: 'admin' });

    await screen.findByRole('heading', { level: 1, name: group.name });
    expect(screen.getByRole('link', { name: 'Moje grupy' }).getAttribute('href')).toBe('/admin');
  });

  it('imports a CSV into the group, reloads the list and shows a toast', async () => {
    const routes = okGroup();
    routes[`GET ${STUDENTS_URL}`] = [
      () => jsonResponse(200, [student(1), student(2)]),
      () => jsonResponse(200, [student(1), student(2), student(3)]),
    ];
    routes[`POST ${IMPORT_URL}`] = [() => jsonResponse(200, report)];
    const fetchMock = mockApi(routes);
    renderPage();
    await screen.findByRole('heading', { name: 'Lista studentów (2)' });

    chooseFile(new File(['login\ns500003\n'], 'grupa.csv', { type: 'text/csv' }));

    expect(await screen.findByRole('heading', { name: 'Lista studentów (3)' })).toBeTruthy();
    expect(screen.getByText('Zaimportowano 1 studenta. Już w grupie: 2.')).toBeTruthy();
    const importCall = fetchMock.mock.calls.find(([url]) => url === IMPORT_URL);
    expect(importCall?.[1]?.method).toBe('POST');
    expect(importCall?.[1]?.body).toBeInstanceOf(FormData);
    // The list was refreshed in place, without the full-page spinner.
    expect(screen.queryByText('Ładowanie grupy…')).toBeNull();
  });

  it('rejects a non-CSV file before sending it', async () => {
    const fetchMock = mockApi(okGroup());
    renderPage();
    await screen.findByRole('heading', { name: 'Lista studentów (2)' });

    chooseFile(new File(['x'], 'lista.txt', { type: 'text/plain' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Plik musi mieć rozszerzenie .csv.',
    );
    expect(fetchMock.mock.calls.some(([url]) => url === IMPORT_URL)).toBe(false);
  });

  it('shows the import error and keeps the list', async () => {
    const routes = okGroup();
    routes[`POST ${IMPORT_URL}`] = [
      () =>
        jsonResponse(400, {
          statusCode: 400,
          message: 'CSV file is missing required "login" header',
        }),
    ];
    mockApi(routes);
    renderPage();
    await screen.findByRole('heading', { name: 'Lista studentów (2)' });

    chooseFile(new File(['name\nx\n'], 'grupa.csv', { type: 'text/csv' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Brak nagłówka „login” w pierwszym wierszu pliku.',
      ),
    );
    expect(screen.getByRole('heading', { name: 'Lista studentów (2)' })).toBeTruthy();
  });
});
