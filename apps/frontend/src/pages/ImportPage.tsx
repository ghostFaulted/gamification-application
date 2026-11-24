import { useState, type DragEvent, type FormEvent } from 'react';
import type { GroupStudentsImportReport, UsersImportReport } from '@gamification/shared';
import { importGroupStudents } from '../api/groups';
import { importUsers, ImportError, validateCsvFile } from '../api/users';
import { Alert, Button } from '../components/ui';
import {
  ChevronDownIcon,
  CloseIcon,
  FileCheckIcon,
  FileErrorIcon,
  FileIcon,
  UploadIcon,
} from '../components/ui/icons';
import './ImportPage.css';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDataRows(count: number): string {
  if (count === 1) return '1 wiersz z danymi';
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} wiersze z danymi`;
  }
  return `${count} wierszy z danymi`;
}

type ImportReport = UsersImportReport | GroupStudentsImportReport;

function isGroupReport(report: ImportReport): report is GroupStudentsImportReport {
  return 'addedLogins' in report;
}

export interface ImportPageProps {
  onBack: () => void;
  /** Import into this group (POST /api/groups/:id/students/import) instead of the general one. */
  group?: { id: string; name: string };
}

export function ImportPage({ onBack, group }: ImportPageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Validation errors block the file; a request error still allows retrying the same file.
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);

  function selectFile(selected: File | undefined) {
    if (!selected || isSubmitting) return;
    setFile(selected);
    setReport(null);
    setImportedName(null);
    setRequestError(null);
    setValidationError(validateCsvFile(selected));
  }

  function clearFile() {
    if (isSubmitting) return;
    setFile(null);
    setValidationError(null);
    setRequestError(null);
  }

  function resetForAnotherFile() {
    setFile(null);
    setReport(null);
    setImportedName(null);
    setValidationError(null);
    setRequestError(null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || validationError || isSubmitting) return;

    setRequestError(null);
    setIsSubmitting(true);
    try {
      const result = group ? await importGroupStudents(group.id, file) : await importUsers(file);
      setImportedName(file.name);
      setReport(result);
      setFile(null);
    } catch (caught) {
      setRequestError(
        caught instanceof ImportError
          ? caught.message
          : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (report && importedName) {
    return (
      <main className="import import--summary">
        {isGroupReport(report) ? (
          <GroupImportSummary
            fileName={importedName}
            groupName={group?.name ?? ''}
            report={report}
            onAnother={resetForAnotherFile}
            onBack={onBack}
          />
        ) : (
          <ImportSummary
            fileName={importedName}
            report={report}
            onAnother={resetForAnotherFile}
            onBack={onBack}
          />
        )}
      </main>
    );
  }

  const dropzoneClass = [
    'import__dropzone',
    isDragging && 'import__dropzone--active',
    file && !validationError && 'import__dropzone--selected',
    validationError && 'import__dropzone--error',
    isSubmitting && 'import__dropzone--disabled',
  ]
    .filter(Boolean)
    .join(' ');

  const invalidFileHint =
    file && file.name.toLowerCase().endsWith('.csv')
      ? 'Wybierz mniejszy plik (maks. 5 MB)'
      : 'Wybierz plik z rozszerzeniem .csv';

  return (
    <main className="import">
      <div className="import__card">
        <h1 className="import__title">
          {group ? `Import studentów do grupy ${group.name}` : 'Import studentów z pliku CSV'}
        </h1>
        <h2 className="import__requirements-title">Wymagania dotyczące pliku</h2>
        <ul className="import__requirements">
          <li>format .csv, maksymalnie 5 MB,</li>
          <li>kodowanie UTF-8,</li>
          <li>
            pierwszy wiersz to nagłówek z kolumną <code>login</code>,
          </li>
          <li>
            kolumny oddzielone przecinkiem lub średnikiem, np. <code>login,imie</code> albo{' '}
            <code>login;imie</code>.
          </li>
        </ul>

        <form className="import__form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
          <label
            htmlFor="import-file"
            className={dropzoneClass}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isSubmitting) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {validationError && file ? (
              <>
                <FileErrorIcon className="import__drop-icon" />
                <span className="import__drop-title">Nieprawidłowy plik: {file.name}</span>
                <span className="import__drop-hint">{invalidFileHint}</span>
              </>
            ) : file ? (
              <>
                <FileCheckIcon className="import__drop-icon" />
                <span className="import__drop-title">Plik gotowy do importu</span>
                <span className="import__drop-hint">
                  {isSubmitting
                    ? 'Trwa wysyłanie pliku…'
                    : 'Kliknij lub przeciągnij inny plik, aby go zmienić'}
                </span>
              </>
            ) : (
              <>
                <UploadIcon className="import__drop-icon" />
                <span className="import__drop-title">
                  Przeciągnij plik CSV tutaj lub kliknij, aby wybrać
                </span>
                <span className="import__drop-hint">
                  Obsługiwany format: .csv (UTF-8), maks. 5 MB
                </span>
              </>
            )}
            <input
              id="import-file"
              className="import__input"
              type="file"
              accept=".csv"
              disabled={isSubmitting}
              onChange={(e) => {
                selectFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>

          {file && !validationError && (
            <div className="import__chip">
              <FileIcon className="import__chip-icon" width={16} height={16} />
              <span className="import__chip-name">{file.name}</span>
              <span className="import__chip-size">{formatFileSize(file.size)}</span>
              {!isSubmitting && (
                <button
                  type="button"
                  className="import__chip-remove"
                  onClick={clearFile}
                  aria-label="Usuń plik"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          )}

          {(validationError ?? requestError) && (
            <Alert type="error">{validationError ?? requestError}</Alert>
          )}

          <div className="import__actions">
            {isSubmitting && (
              <p className="import__processing" role="status">
                Przetwarzanie pliku… Nie zamykaj tej strony.
              </p>
            )}
            <Button type="button" variant="secondary" onClick={onBack} disabled={isSubmitting}>
              Anuluj
            </Button>
            <Button
              type="submit"
              disabled={!file || Boolean(validationError)}
              loading={isSubmitting}
            >
              {isSubmitting ? 'Importowanie…' : 'Importuj'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

function ImportSummary({
  fileName,
  report,
  onAnother,
  onBack,
}: {
  fileName: string;
  report: UsersImportReport;
  onAnother: () => void;
  onBack: () => void;
}) {
  const dataRows = report.created + report.skippedDuplicates + report.invalid;

  return (
    <section className="import__summary" aria-label="Podsumowanie importu" aria-live="polite">
      <header>
        <h1 className="import__title">Podsumowanie importu</h1>
        <p className="import__summary-meta">
          Plik {fileName} · {formatDataRows(dataRows)}
        </p>
      </header>

      <dl className="import__stats">
        <div className="import__stat">
          <dt>Utworzono</dt>
          <dd className="import__stat-value import__stat-value--success">{report.created}</dd>
        </div>
        <div className="import__stat">
          <dt>Pominięto (duplikaty)</dt>
          <dd className="import__stat-value">{report.skippedDuplicates}</dd>
        </div>
        <div className="import__stat">
          <dt>Błędne wiersze</dt>
          <dd className="import__stat-value import__stat-value--danger">{report.invalid}</dd>
        </div>
      </dl>

      <div className="import__tables">
        <LoginTable title="Dodani studenci" logins={report.createdLogins} numbered />
        <LoginTable
          title="Pominięci – już w bazie lub powtórzeni w pliku"
          logins={report.skippedLogins}
        />
        <RowErrors errors={report.errors} />
      </div>

      <div className="import__actions">
        <Button type="button" variant="secondary" onClick={onAnother}>
          Importuj kolejny plik
        </Button>
        <Button type="button" onClick={onBack}>
          Wróć
        </Button>
      </div>
    </section>
  );
}

function GroupImportSummary({
  fileName,
  groupName,
  report,
  onAnother,
  onBack,
}: {
  fileName: string;
  groupName: string;
  report: GroupStudentsImportReport;
  onAnother: () => void;
  onBack: () => void;
}) {
  const dataRows =
    report.added +
    report.alreadyInGroup +
    report.notStudentLogins.length +
    report.duplicatesInFile +
    report.invalid;

  return (
    <section className="import__summary" aria-label="Podsumowanie importu" aria-live="polite">
      <header>
        <h1 className="import__title">Podsumowanie importu do grupy {groupName}</h1>
        <p className="import__summary-meta">
          Plik {fileName} · {formatDataRows(dataRows)} · nowe konta: {report.createdAccounts}
        </p>
      </header>

      <dl className="import__stats">
        <div className="import__stat">
          <dt>Dodano do grupy</dt>
          <dd className="import__stat-value import__stat-value--success">{report.added}</dd>
        </div>
        <div className="import__stat">
          <dt>Już w grupie</dt>
          <dd className="import__stat-value">{report.alreadyInGroup}</dd>
        </div>
        <div className="import__stat">
          <dt>Błędne wiersze</dt>
          <dd className="import__stat-value import__stat-value--danger">{report.invalid}</dd>
        </div>
      </dl>

      <div className="import__tables">
        <LoginTable title="Dodani do grupy" logins={report.addedLogins} numbered />
        <LoginTable title="Już byli w grupie" logins={report.alreadyInGroupLogins} />
        {report.notStudentLogins.length > 0 && (
          <LoginTable
            title="Pominięci – konta prowadzących lub administratorów"
            logins={report.notStudentLogins}
          />
        )}
        <RowErrors errors={report.errors} />
      </div>

      <div className="import__actions">
        <Button type="button" variant="secondary" onClick={onAnother}>
          Importuj kolejny plik
        </Button>
        <Button type="button" onClick={onBack}>
          Wróć do listy grup
        </Button>
      </div>
    </section>
  );
}

function RowErrors({ errors }: { errors: UsersImportReport['errors'] }) {
  if (errors.length === 0) return null;
  return (
    <details className="import__panel import__details" open>
      <summary className="import__details-summary">
        <span>Błędne wiersze ({errors.length})</span>
        <ChevronDownIcon className="import__details-chevron" />
      </summary>
      <div className="import__table-wrap">
        <table className="import__table">
          <thead>
            <tr>
              <th scope="col">Wiersz</th>
              <th scope="col">Wartość</th>
              <th scope="col">Powód</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((rowError) => (
              <tr key={rowError.row}>
                <td>{rowError.row}</td>
                <td>{rowError.value || '–'}</td>
                <td>{rowError.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function LoginTable({
  title,
  logins,
  numbered = false,
}: {
  title: string;
  logins: string[];
  numbered?: boolean;
}) {
  return (
    <div className="import__panel">
      <h2 className="import__panel-title">
        {title} ({logins.length})
      </h2>
      {logins.length === 0 ? (
        <p className="import__empty">Brak</p>
      ) : (
        <div className="import__table-wrap">
          <table className="import__table">
            <thead>
              <tr>
                {numbered && <th scope="col">Lp.</th>}
                <th scope="col">Login</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((login, index) => (
                // A skipped login can repeat, so the index is part of the key.
                <tr key={`${index}-${login}`}>
                  {numbered && <td>{index + 1}</td>}
                  <td>{login}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
