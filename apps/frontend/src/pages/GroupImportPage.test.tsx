// @vitest-environment jsdom
import type { GroupDto, GroupStudentsImportReport } from '@gamification/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupImportPage } from './GroupImportPage';
import { jsonResponse, mockApi } from '../test/api';

const GROUP_ID = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f';
const GROUP_URL = `/api/groups/${GROUP_ID}`;
const IMPORT_URL = `${GROUP_URL}/students/import`;

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
  studentCount: 0,
  createdAt: '2026-11-18T10:00:00.000Z',
  updatedAt: '2026-11-18T10:00:00.000Z',
};

const report: GroupStudentsImportReport = {
  added: 2,
  addedLogins: ['s1', 's2'],
  createdAccounts: 1,
  createdLogins: ['s2'],
  alreadyInGroup: 1,
  alreadyInGroupLogins: ['student1'],
  notStudentLogins: [],
  duplicatesInFile: 0,
  invalid: 0,
  errors: [],
};

function renderPage(groupId = GROUP_ID) {
  return render(
    <MemoryRouter initialEntries={[`/lecturer/groups/${groupId}/import`]}>
      <Routes>
        <Route path="/lecturer/groups/:groupId/import" element={<GroupImportPage />} />
        <Route path="/lecturer" element={<p>Lista grup</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function chooseFile(file: File) {
  const input = document.getElementById('import-file');
  if (!input) throw new Error('Missing import file input');
  fireEvent.change(input, { target: { files: [file] } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GroupImportPage', () => {
  it('loads the group and then shows the import form for it', async () => {
    mockApi({ [`GET ${GROUP_URL}`]: [() => jsonResponse(200, group)] });
    renderPage();

    expect(screen.getByRole('status').textContent).toContain('Ładowanie grupy');
    expect(
      await screen.findByRole('heading', { name: `Import studentów do grupy ${group.name}` }),
    ).toBeTruthy();
  });

  it("shows a readable message for another lecturer's group (403)", async () => {
    mockApi({
      [`GET ${GROUP_URL}`]: [() => jsonResponse(403, { statusCode: 403, message: 'Forbidden' })],
    });
    renderPage();

    expect((await screen.findByRole('alert')).textContent).toBe('Nie masz dostępu do tej grupy.');
    expect(screen.getByRole('link', { name: 'Wróć do listy grup' }).getAttribute('href')).toBe(
      '/lecturer',
    );
  });

  it('shows a readable message for a missing group (404)', async () => {
    mockApi({
      [`GET ${GROUP_URL}`]: [() => jsonResponse(404, { statusCode: 404, message: 'Not found' })],
    });
    renderPage();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Grupa nie istnieje lub została usunięta.',
    );
  });

  it('shows the import summary after a successful upload', async () => {
    const fetchMock = mockApi({
      [`GET ${GROUP_URL}`]: [() => jsonResponse(200, group)],
      [`POST ${IMPORT_URL}`]: [() => jsonResponse(200, report)],
    });
    renderPage();
    await screen.findByRole('heading', { name: `Import studentów do grupy ${group.name}` });

    chooseFile(new File(['login\ns1\n'], 'grupa.csv', { type: 'text/csv' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importuj' }));

    expect(
      await screen.findByRole('heading', { name: `Podsumowanie importu do grupy ${group.name}` }),
    ).toBeTruthy();
    expect(screen.getByText('Plik grupa.csv · 3 wiersze z danymi · nowe konta: 1')).toBeTruthy();
    expect(screen.getByText('Dodano do grupy').parentElement?.textContent).toContain('2');
    expect(screen.getByText('Już w grupie').parentElement?.textContent).toContain('1');
    expect(screen.getByText('s1')).toBeTruthy();
    expect(screen.getByText('student1')).toBeTruthy();
    const importCall = fetchMock.mock.calls.find(([url]) => url === IMPORT_URL);
    expect(importCall?.[1]?.method).toBe('POST');
    expect(importCall?.[1]?.body).toBeInstanceOf(FormData);
  });
});
