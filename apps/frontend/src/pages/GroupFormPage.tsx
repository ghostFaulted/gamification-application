import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { CourseDto, GroupDto } from '@gamification/shared';
import { ApiError } from '../api/client';
import {
  createGroup,
  fetchCourses,
  fetchGroup,
  groupErrorMessage,
  updateGroup,
} from '../api/groups';
import { Alert, Button, ButtonLink, Input } from '../components/ui';
import { SpinnerIcon } from '../components/ui/icons';
import { ROLE_HOME } from '../routes/roles';
import '../components/ui/Input.css';
import './GroupFormPage.css';

/** Same limits as groups.validation.ts in the backend. */
const MAX_NAME_LENGTH = 120;
const MAX_SEMESTER_LENGTH = 32;
const MAX_DESCRIPTION_LENGTH = 2000;

type Mode = 'create' | 'edit';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; courses: CourseDto[]; group: GroupDto | null };

interface FormValues {
  courseId: string;
  name: string;
  semester: string;
  description: string;
}

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const EMPTY_VALUES: FormValues = { courseId: '', name: '', semester: '', description: '' };

function courseLabel(course: { name: string; code: string | null }): string {
  return course.code ? `${course.name} (${course.code})` : course.name;
}

/** Mirrors the backend validation; texts are trimmed, empty optional fields become null. */
function validate(values: FormValues, mode: Mode): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === 'create' && !values.courseId) errors.courseId = 'Wybierz przedmiot.';
  const name = values.name.trim();
  if (!name) errors.name = 'Podaj nazwę grupy.';
  else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Nazwa grupy może mieć maksymalnie ${MAX_NAME_LENGTH} znaków.`;
  }
  if (values.semester.trim().length > MAX_SEMESTER_LENGTH) {
    errors.semester = `Semestr może mieć maksymalnie ${MAX_SEMESTER_LENGTH} znaki.`;
  }
  if (values.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Opis może mieć maksymalnie ${MAX_DESCRIPTION_LENGTH} znaków.`;
  }
  return errors;
}

/** Create (POST /api/groups) or edit (PATCH /api/groups/:id) a group; back to the group list. */
export function GroupFormPage({ mode }: { mode: Mode }) {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by "Spróbuj ponownie" to load the data again.
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load =
      mode === 'edit'
        ? fetchGroup(groupId, controller.signal).then((group) => {
            setValues({
              courseId: group.courseId,
              name: group.name,
              semester: group.semester ?? '',
              description: group.description ?? '',
            });
            setState({ status: 'ready', courses: [], group });
          })
        : fetchCourses(controller.signal).then((courses) => {
            setValues({ ...EMPTY_VALUES, courseId: courses.length === 1 ? courses[0].id : '' });
            setState({ status: 'ready', courses, group: null });
          });
    load.catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState({ status: 'error', message: groupErrorMessage(error) });
    });
    return () => controller.abort();
  }, [mode, groupId, attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  function update(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validate(values, mode);
    setFieldErrors(errors);
    setSubmitError(null);
    if (Object.values(errors).some(Boolean)) return;

    const body = {
      name: values.name.trim(),
      semester: values.semester.trim() || null,
      description: values.description.trim() || null,
    };

    setIsSubmitting(true);
    try {
      if (mode === 'edit') await updateGroup(groupId, body);
      else await createGroup({ ...body, courseId: values.courseId });
      void navigate(ROLE_HOME.lecturer);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ name: 'Grupa o tej nazwie już istnieje w tym przedmiocie.' });
      } else if (error instanceof ApiError && /course not found/i.test(error.message)) {
        setFieldErrors({ courseId: 'Wybrany przedmiot nie istnieje. Odśwież stronę.' });
      } else if (error instanceof ApiError && error.status === 400) {
        setSubmitError('Sprawdź poprawność danych w formularzu.');
      } else {
        setSubmitError(groupErrorMessage(error));
      }
      setIsSubmitting(false);
    }
  }

  const title = mode === 'edit' ? 'Edycja grupy' : 'Nowa grupa';

  if (state.status === 'loading') {
    return (
      <main className="group-form">
        <p className="group-form__loading" role="status">
          <SpinnerIcon className="group-form__spinner" />
          {mode === 'edit' ? 'Ładowanie grupy…' : 'Ładowanie przedmiotów…'}
        </p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="group-form">
        <div className="group-form__card">
          <h1 className="group-form__title">{title}</h1>
          <Alert type="error">{state.message}</Alert>
          <div className="group-form__actions">
            <ButtonLink to={ROLE_HOME.lecturer} variant="secondary">
              Wróć do listy grup
            </ButtonLink>
            <Button onClick={retry}>Spróbuj ponownie</Button>
          </div>
        </div>
      </main>
    );
  }

  const { courses, group } = state;
  const noCourses = mode === 'create' && courses.length === 0;
  const courseError = fieldErrors.courseId;
  const descriptionError = fieldErrors.description;

  return (
    <main className="group-form">
      <div className="group-form__card">
        <h1 className="group-form__title">{title}</h1>
        <p className="group-form__subtitle">
          {mode === 'edit'
            ? 'Zmień nazwę, semestr lub opis grupy zajęciowej.'
            : 'Utwórz grupę zajęciową, a potem zaimportuj do niej studentów z pliku CSV.'}
        </p>

        {noCourses ? (
          <>
            <Alert type="info">
              Brak przedmiotów, do których można przypisać grupę. Poproś administratora o dodanie
              przedmiotu.
            </Alert>
            <div className="group-form__actions">
              <ButtonLink to={ROLE_HOME.lecturer} variant="secondary">
                Wróć do listy grup
              </ButtonLink>
            </div>
          </>
        ) : (
          <form className="group-form__form" onSubmit={handleSubmit} noValidate>
            {group ? (
              <Input
                id="group-course"
                label="Przedmiot"
                value={courseLabel({ name: group.courseName, code: group.courseCode })}
                hint="Przedmiotu nie można zmienić po utworzeniu grupy."
                disabled
                readOnly
              />
            ) : (
              <div className="ui-input">
                <label className="ui-input__label" htmlFor="group-course">
                  Przedmiot
                </label>
                <div className={`ui-input__field${courseError ? ' ui-input__field--error' : ''}`}>
                  <select
                    id="group-course"
                    className="ui-input__control"
                    value={values.courseId}
                    onChange={(e) => update('courseId', e.target.value)}
                    disabled={isSubmitting}
                    required
                    aria-invalid={Boolean(courseError)}
                    aria-describedby={courseError ? 'group-course-error' : undefined}
                  >
                    <option value="">Wybierz przedmiot</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {courseLabel(course)}
                      </option>
                    ))}
                  </select>
                </div>
                {courseError && (
                  <span
                    id="group-course-error"
                    className="ui-input__message ui-input__message--error"
                  >
                    {courseError}
                  </span>
                )}
              </div>
            )}

            <Input
              id="group-name"
              label="Nazwa grupy"
              placeholder="np. Grupa 1"
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              error={fieldErrors.name}
              maxLength={MAX_NAME_LENGTH}
              disabled={isSubmitting}
              required
            />

            <Input
              id="group-semester"
              label="Semestr (opcjonalnie)"
              placeholder="np. zimowy 2026/2027"
              value={values.semester}
              onChange={(e) => update('semester', e.target.value)}
              error={fieldErrors.semester}
              maxLength={MAX_SEMESTER_LENGTH}
              disabled={isSubmitting}
            />

            <div className="ui-input">
              <label className="ui-input__label" htmlFor="group-description">
                Opis (opcjonalnie)
              </label>
              <div
                className={`ui-input__field${descriptionError ? ' ui-input__field--error' : ''}`}
              >
                <textarea
                  id="group-description"
                  className="ui-input__control group-form__textarea"
                  rows={4}
                  value={values.description}
                  onChange={(e) => update('description', e.target.value)}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(descriptionError)}
                  aria-describedby={descriptionError ? 'group-description-error' : undefined}
                />
              </div>
              {descriptionError && (
                <span
                  id="group-description-error"
                  className="ui-input__message ui-input__message--error"
                >
                  {descriptionError}
                </span>
              )}
            </div>

            {submitError && <Alert type="error">{submitError}</Alert>}

            <div className="group-form__actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void navigate(ROLE_HOME.lecturer)}
                disabled={isSubmitting}
              >
                Anuluj
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {mode === 'edit' ? 'Zapisz zmiany' : 'Utwórz grupę'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
