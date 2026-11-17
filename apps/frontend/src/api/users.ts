import type { UsersImportReport } from '@gamification/shared';
import { ApiError, apiFetch } from './client';

/** Same limit as MAX_CSV_SIZE_BYTES in the backend. */
export const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024;

export class ImportError extends Error {}

// Known backend messages (CsvParserService, multer, RolesGuard) mapped to Polish.
const translations: Array<[RegExp, string]> = [
  [/missing required "login" header/i, 'Brak nagłówka „login” w pierwszym wierszu pliku.'],
  [/duplicate "login" header/i, 'Plik zawiera więcej niż jedną kolumnę „login”.'],
  [/CSV file is empty/i, 'Plik CSV jest pusty.'],
  [/CSV file is required/i, 'Nie wybrano pliku CSV.'],
  [/Malformed CSV/i, 'Nieprawidłowy format pliku CSV.'],
  [/must not contain line breaks/i, 'Wartości w pliku CSV nie mogą zawierać znaków nowej linii.'],
  [/extension|MIME type/i, 'Nieprawidłowy typ pliku. Wymagany jest plik .csv.'],
  [/maximum allowed size|File too large/i, 'Plik przekracza maksymalny rozmiar 5 MB.'],
  [/UTF-8/i, 'Plik CSV musi być zapisany w kodowaniu UTF-8.'],
  [/permission/i, 'Brak uprawnień do importu studentów.'],
  [/^Login is empty$/i, 'Pusty login.'],
  [/^Login exceeds (\d+) characters$/i, 'Login jest dłuższy niż $1 znaki.'],
  [/^Login contains invalid characters$/i, 'Login zawiera niedozwolone znaki.'],
];

export function translateImportMessage(message: string): string {
  for (const [pattern, translation] of translations) {
    const match = message.match(pattern);
    if (match) return translation.replace('$1', match[1] ?? '');
  }
  return message;
}

/** Checks the file before upload; returns a Polish error or null. */
export function validateCsvFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) return 'Plik musi mieć rozszerzenie .csv.';
  if (file.size > MAX_CSV_SIZE_BYTES) return 'Plik przekracza maksymalny rozmiar 5 MB.';
  return null;
}

/** Sends the file to POST /api/users/import; a 401 is handled by apiFetch (session expired). */
export async function importUsers(file: File): Promise<UsersImportReport> {
  const body = new FormData();
  body.append('file', file);

  try {
    const report = await apiFetch<UsersImportReport>('/api/users/import', { method: 'POST', body });
    return {
      ...report,
      errors: report.errors.map((e) => ({ ...e, reason: translateImportMessage(e.reason) })),
    };
  } catch (error) {
    if (error instanceof ApiError) throw new ImportError(translateImportMessage(error.message));
    throw error;
  }
}
