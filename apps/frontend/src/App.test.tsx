// @vitest-environment jsdom
import type { AuthUser, GroupDto, GroupStudentDto } from '@gamification/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { AuthContext, type AuthContextValue } from './auth/AuthContext';
import { jsonResponse, mockApi } from './test/api';

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
  studentCount: 1,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

const student: GroupStudentDto = {
  id: 'id-1',
  login: 's500001',
  assignedAt: '2026-11-18T10:00:00.000Z',
};

function authValue(user: AuthUser): AuthContextValue {
  return {
    user,
    sessionStatus: 'ready',
    sessionError: null,
    retrySessionCheck: vi.fn(),
    logoutReason: null,
    isLoggingOut: false,
    logoutError: null,
    login: vi.fn(),
    logout: vi.fn(),
  };
}

function LocationPath() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(path: string, user: AuthUser) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authValue(user)}>
        <LocationPath />
        <AppRoutes />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const lecturer: AuthUser = { login: 'lecturer1', role: 'lecturer' };
const admin: AuthUser = { login: 'admin1', role: 'admin' };
const studentUser: AuthUser = { login: 's500001', role: 'student' };

function stubGroupView() {
  mockApi({
    [`GET /api/groups/${GROUP_ID}`]: [() => jsonResponse(200, group)],
    [`GET /api/groups/${GROUP_ID}/students`]: [() => jsonResponse(200, [student])],
    'GET /api/groups': [() => jsonResponse(200, [group])],
    'GET /api/courses': [() => jsonResponse(200, [])],
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('group view routes', () => {
  it('opens the group view at /lecturer/groups/:id', async () => {
    stubGroupView();
    renderAt(`/lecturer/groups/${GROUP_ID}`, lecturer);

    expect(await screen.findByRole('heading', { level: 1, name: group.name })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe(`/lecturer/groups/${GROUP_ID}`);
  });

  it('redirects /groups/:id to /lecturer/groups/:id', async () => {
    stubGroupView();
    renderAt(`/groups/${GROUP_ID}`, lecturer);

    expect(await screen.findByRole('heading', { level: 1, name: group.name })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe(`/lecturer/groups/${GROUP_ID}`);
  });

  it('lets an admin open the group view and the group list', async () => {
    stubGroupView();
    renderAt(`/lecturer/groups/${GROUP_ID}`, admin);

    expect(await screen.findByRole('heading', { level: 1, name: group.name })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Moje grupy' }).getAttribute('href')).toBe('/lecturer');
  });

  it('lets an admin open the group list at /lecturer', async () => {
    stubGroupView();
    renderAt('/lecturer', admin);

    expect(await screen.findByRole('heading', { level: 1, name: 'Grupy' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/lecturer');
    expect(screen.getByRole('link', { name: group.name }).getAttribute('href')).toBe(
      `/lecturer/groups/${GROUP_ID}`,
    );
  });

  it('does not treat /lecturer/groups/new as a group id', async () => {
    stubGroupView();
    renderAt('/lecturer/groups/new', lecturer);

    expect(await screen.findByRole('heading', { level: 1, name: 'Nowa grupa' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/lecturer/groups/new');
    expect(screen.queryByText('Ładowanie grupy…')).toBeNull();
  });

  it('lets an admin open the group create form', async () => {
    stubGroupView();
    renderAt('/lecturer/groups/new', admin);

    expect(await screen.findByRole('heading', { level: 1, name: 'Nowa grupa' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/lecturer/groups/new');
  });

  it('opens the edit form at /lecturer/groups/:id/edit, not the group view', async () => {
    stubGroupView();
    renderAt(`/lecturer/groups/${GROUP_ID}/edit`, lecturer);

    expect(await screen.findByRole('heading', { level: 1, name: 'Edycja grupy' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe(`/lecturer/groups/${GROUP_ID}/edit`);
  });

  it('sends a student away from the group view to their start page', async () => {
    stubGroupView();
    renderAt(`/lecturer/groups/${GROUP_ID}`, studentUser);

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/student'));
    expect(screen.getByRole('heading', { name: 'Panel: Student' })).toBeTruthy();
  });
});
