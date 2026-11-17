import { useState, type DragEvent, type FormEvent } from 'react';
import type { UsersImportReport } from '@gamification/shared';
import { importUsers, ImportError, validateCsvFile } from '../api/users';
import './ImportPage.css';

export function ImportPage({ onBack }: { onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [report, setReport] = useState<UsersImportReport | null>(null);

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setReport(null);
    setError(validateCsvFile(selected));
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!isSubmitting) selectFile(event.dataTransfer.files[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || error) return;

    setIsSubmitting(true);
    try {
      setReport(await importUsers(file));
      setFile(null);
    } catch (caught) {
      setError(
        caught instanceof ImportError
          ? caught.message
          : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="import">
      <div className="import__card">
        <button type="button" className="import__back" onClick={onBack}>
          ← Wróć
        </button>
        <h1 className="import__title">Import studentów z pliku CSV</h1>
        <ul className="import__requirements" aria-label="Wymagania dotyczące pliku">
          <li>format .csv, maksymalnie 5 MB,</li>
          <li>
            pierwszy wiersz to nagłówek z kolumną <code>login</code>,
          </li>
          <li>
            kolumny oddzielone przecinkiem lub średnikiem, np. <code>login,imie</code> albo{' '}
            <code>login;imie</code>.
          </li>
        </ul>

        <form className="import__form" onSubmit={handleSubmit} noValidate>
          <label
            htmlFor="import-file"
            className={`import__dropzone${isDragging ? ' import__dropzone--active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span className="import__drop-title">
              {file ? file.name : 'Przeciągnij plik CSV tutaj lub kliknij, aby wybrać'}
            </span>
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

          {error && (
            <div className="import__alert" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="import__submit"
            disabled={!file || Boolean(error) || isSubmitting}
          >
            {isSubmitting && <span className="import__spinner" aria-hidden="true" />}
            {isSubmitting ? 'Importowanie…' : 'Importuj'}
          </button>
        </form>

        <div aria-live="polite">{report && <ImportSummary report={report} />}</div>
      </div>
    </main>
  );
}

function ImportSummary({ report }: { report: UsersImportReport }) {
  return (
    <section className="import__summary" aria-label="Podsumowanie importu">
      <p className="import__notice" role="status">
        Import zakończony: utworzono {report.created}, pominięto {report.skippedDuplicates}{' '}
        (duplikaty), błędnych wierszy: {report.invalid}.
      </p>

      <LoginTable title="Dodani studenci" logins={report.createdLogins} />
      <LoginTable
        title="Pominięci (już w bazie lub powtórzeni w pliku)"
        logins={report.skippedLogins}
      />

      {report.errors.length > 0 && (
        <details className="import__details">
          <summary>Błędne wiersze ({report.errors.length})</summary>
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
                {report.errors.map((rowError) => (
                  <tr key={rowError.row}>
                    <td>{rowError.row}</td>
                    <td>{rowError.value || '—'}</td>
                    <td>{rowError.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

function LoginTable({ title, logins }: { title: string; logins: string[] }) {
  if (logins.length === 0) return null;
  return (
    <div className="import__table-wrap">
      <table className="import__table">
        <caption>
          {title} ({logins.length})
        </caption>
        <thead>
          <tr>
            <th scope="col">Nr</th>
            <th scope="col">Login</th>
          </tr>
        </thead>
        <tbody>
          {logins.map((login, index) => (
            // A skipped login can repeat, so the index is part of the key.
            <tr key={`${index}-${login}`}>
              <td>{index + 1}</td>
              <td>{login}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
