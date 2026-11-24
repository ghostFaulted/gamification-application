// @vitest-environment jsdom
import type { GroupDto } from '@gamification/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LecturerGroupsPage } from './LecturerGroupsPage';
import { jsonResponse, mockApi } from '../test/api';

const group: GroupDto = {
  id: '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f',
  courseId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  courseName: 'Programowanie obiektowe',
  courseCode: 'PO',
  lecturerId: '9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b',
  lecturerLogin: 'lecturer1',
  name: 'Programowanie obiektowe – gr. 2',
  semester: 'zimowy 2026/2027',
  description: 'Wtorek 10:15',
  studentCount: 2,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

const emptyGroup: GroupDto = {
  ...group,
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  name: 'Grupa 1',
  courseCode: null,
  description: null,
  studentCount: 0,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <LecturerGroupsPage />
    </MemoryRouter>,
  );
}

function cardNamed(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name });
  const card = heading.closest('article');
  if (!card) throw new Error(`No card for ${name}`);
  return card;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LecturerGroupsPage', () => {
  it('shows the empty state when the lecturer has no groups', async () => {
    mockApi({ 'GET /api/groups': [() => jsonResponse(200, [])] });
    renderPage();

    expect(screen.getByText('Ładowanie grup…')).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Nie masz jeszcze żadnych grup' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Utwórz pierwszą grupę' }).getAttribute('href')).toBe(
      '/lecturer/groups/new',
    );
    expect(screen.getByRole('link', { name: 'Nowa grupa' }).getAttribute('href')).toBe(
      '/lecturer/groups/new',
    );
  });

  it('renders cards with a link to the group view, edit, import and the student count', async () => {
    mockApi({ 'GET /api/groups': [() => jsonResponse(200, [group, emptyGroup])] });
    renderPage();

    expect(await screen.findByText('Semestr zimowy 2026/2027 · 2 grupy zajęciowe')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Moje grupy' })).toBeTruthy();

    const populated = within(cardNamed(group.name));
    expect(populated.getByRole('link', { name: group.name }).getAttribute('href')).toBe(
      `/lecturer/groups/${group.id}`,
    );
    expect(
      populated.getByRole('link', { name: `Edytuj grupę ${group.name}` }).getAttribute('href'),
    ).toBe(`/lecturer/groups/${group.id}/edit`);
    expect(populated.getByText('Programowanie obiektowe (PO) · zimowy 2026/2027')).toBeTruthy();
    expect(populated.getByText('Wtorek 10:15')).toBeTruthy();
    expect(populated.getByText('2 studentów')).toBeTruthy();
    expect(
      populated.queryByRole('link', { name: `Import studentów z CSV do grupy ${group.name}` }),
    ).toBeNull();

    const empty = within(cardNamed(emptyGroup.name));
    expect(empty.getByRole('link', { name: emptyGroup.name }).getAttribute('href')).toBe(
      `/lecturer/groups/${emptyGroup.id}`,
    );
    expect(empty.getByText('Brak studentów w grupie')).toBeTruthy();
    expect(empty.getByText('Programowanie obiektowe · zimowy 2026/2027')).toBeTruthy();
    expect(
      empty
        .getByRole('link', { name: `Import studentów z CSV do grupy ${emptyGroup.name}` })
        .getAttribute('href'),
    ).toBe(`/lecturer/groups/${emptyGroup.id}/import`);
  });

  it('uses the singular label for one student', async () => {
    mockApi({
      'GET /api/groups': [
        () => jsonResponse(200, [{ ...group, studentCount: 1, description: null }]),
      ],
    });
    renderPage();

    expect(await screen.findByText('1 student')).toBeTruthy();
    expect(screen.getByText('Semestr zimowy 2026/2027 · 1 grupa zajęciowa')).toBeTruthy();
  });

  it('lets the user retry after a failed load', async () => {
    mockApi({
      'GET /api/groups': [
        () => jsonResponse(500, { statusCode: 500, message: 'Internal server error' }),
        () => jsonResponse(200, [emptyGroup]),
      ],
    });
    renderPage();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Nie udało się pobrać listy grup. Spróbuj ponownie.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(await screen.findByRole('heading', { level: 2, name: emptyGroup.name })).toBeTruthy();
  });
});
