// @vitest-environment jsdom
import type { CourseDto, GroupDto } from '@gamification/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupFormPage } from './GroupFormPage';

const COURSE_A: CourseDto = {
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Programowanie obiektowe',
  code: 'PO',
  description: null,
  createdBy: '9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b',
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

const COURSE_B: CourseDto = {
  ...COURSE_A,
  id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
  name: 'Algorytmy',
  code: null,
};

const GROUP_ID = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f';

const group: GroupDto = {
  id: GROUP_ID,
  courseId: COURSE_A.id,
  courseName: COURSE_A.name,
  courseCode: COURSE_A.code,
  lecturerId: '9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b',
  lecturerLogin: 'lecturer1',
  name: 'Programowanie obiektowe – gr. 2',
  semester: 'zimowy 2026/2027',
  description: 'Wtorek 10:15',
  studentCount: 2,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
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

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/lecturer/groups/new']}>
      <Routes>
        <Route path="/lecturer/groups/new" element={<GroupFormPage mode="create" />} />
        <Route path="/lecturer" element={<p>Lista grup</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={[`/lecturer/groups/${GROUP_ID}/edit`]}>
      <Routes>
        <Route path="/lecturer/groups/:groupId/edit" element={<GroupFormPage mode="edit" />} />
        <Route path="/lecturer" element={<p>Lista grup</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GroupFormPage', () => {
  it('validates a new group on the client before calling the API', async () => {
    const fetchMock = mockApi({
      'GET /api/courses': [() => jsonResponse(200, [COURSE_A, COURSE_B])],
    });
    renderCreate();

    expect(await screen.findByRole('heading', { name: 'Nowa grupa' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz grupę' }));

    expect(screen.getByText('Wybierz przedmiot.')).toBeTruthy();
    expect(screen.getByText('Podaj nazwę grupy.')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([url, init]) => url === '/api/groups' && init?.method === 'POST'),
    ).toBe(false);
  });

  it('shows a field error when the group name is already used in the course (409)', async () => {
    const fetchMock = mockApi({
      'GET /api/courses': [() => jsonResponse(200, [COURSE_A, COURSE_B])],
      'POST /api/groups': [
        () =>
          jsonResponse(409, { statusCode: 409, message: 'A group with this name already exists' }),
      ],
    });
    renderCreate();
    await screen.findByRole('heading', { name: 'Nowa grupa' });

    fireEvent.change(screen.getByLabelText('Przedmiot'), { target: { value: COURSE_A.id } });
    fireEvent.change(screen.getByLabelText('Nazwa grupy'), { target: { value: 'Grupa 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz grupę' }));

    expect(
      await screen.findByText('Grupa o tej nazwie już istnieje w tym przedmiocie.'),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/groups',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.queryByText('Lista grup')).toBeNull();
  });

  it('prefills the edit form and keeps the course read-only', async () => {
    mockApi({
      [`GET /api/groups/${GROUP_ID}`]: [() => jsonResponse(200, group)],
    });
    renderEdit();

    expect(await screen.findByRole('heading', { name: 'Edycja grupy' })).toBeTruthy();
    expect((screen.getByLabelText('Nazwa grupy') as HTMLInputElement).value).toBe(group.name);
    expect((screen.getByLabelText('Semestr (opcjonalnie)') as HTMLInputElement).value).toBe(
      'zimowy 2026/2027',
    );
    expect((screen.getByLabelText('Opis (opcjonalnie)') as HTMLTextAreaElement).value).toBe(
      'Wtorek 10:15',
    );
    const course = screen.getByLabelText('Przedmiot') as HTMLInputElement;
    expect(course.value).toBe('Programowanie obiektowe (PO)');
    expect(course.disabled).toBe(true);
    expect(screen.getByText('Przedmiotu nie można zmienić po utworzeniu grupy.')).toBeTruthy();
  });

  it('goes back to the group list on cancel without saving', async () => {
    const fetchMock = mockApi({
      [`GET /api/groups/${GROUP_ID}`]: [() => jsonResponse(200, group)],
    });
    renderEdit();
    await screen.findByRole('heading', { name: 'Edycja grupy' });

    fireEvent.change(screen.getByLabelText('Nazwa grupy'), { target: { value: 'Inna nazwa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(await screen.findByText('Lista grup')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => url === `/api/groups/${GROUP_ID}` && init?.method === 'PATCH',
      ),
    ).toBe(false);
  });
});
