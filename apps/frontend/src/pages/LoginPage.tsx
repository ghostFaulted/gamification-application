import { useState, type FormEvent } from 'react';
import { LoginError } from '../api/auth';
import { useAuth, type LogoutReason } from '../auth/AuthContext';
import { Alert, Button, Input } from '../components/ui';
import './LoginPage.css';

interface FieldErrors {
  login?: string;
  password?: string;
}

const logoutNotices: Record<LogoutReason, string> = {
  expired: 'Sesja wygasła. Zaloguj się ponownie.',
  manual: 'Wylogowano pomyślnie.',
};

export function LoginPage() {
  const { login, logoutReason } = useAuth();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState(logoutReason ? logoutNotices[logoutReason] : null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!loginValue.trim()) errors.login = 'Podaj login.';
    if (!password) errors.password = 'Podaj hasło.';
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login({ login: loginValue.trim(), password });
    } catch (error) {
      setFormError(
        error instanceof LoginError
          ? error.message
          : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
      );
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <header className="login__header">
          <div className="login__logo" aria-hidden="true">
            G
          </div>
          <h1 className="login__title">Grywalizacja</h1>
          <p className="login__subtitle">Wydział Matematyki i Informatyki UAM</p>
        </header>

        {formError && (
          <Alert type="error" className="login__alert">
            {formError}
          </Alert>
        )}

        {notice && (
          <Alert type="info" className="login__alert">
            {notice}
          </Alert>
        )}

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <Input
            id="login"
            label="Login"
            name="login"
            type="text"
            autoComplete="username"
            placeholder="np. s123456"
            value={loginValue}
            onChange={(e) => {
              setLoginValue(e.target.value);
              setFieldErrors((prev) => ({ ...prev, login: undefined }));
              setFormError(null);
              setNotice(null);
            }}
            error={fieldErrors.login}
            hint="Ten sam login co w laboratoriach wydziałowych (domena LABS)."
            disabled={isSubmitting}
            autoFocus
          />

          <Input
            id="password"
            label="Hasło"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
              setFormError(null);
              setNotice(null);
            }}
            error={fieldErrors.password}
            toggle={{
              label: showPassword ? 'Ukryj' : 'Pokaż',
              ariaLabel: showPassword ? 'Ukryj hasło' : 'Pokaż hasło',
              onToggle: () => setShowPassword((v) => !v),
            }}
            disabled={isSubmitting}
          />

          <Button type="submit" className="login__submit" loading={isSubmitting}>
            {isSubmitting ? 'Logowanie…' : 'Zaloguj się'}
          </Button>
        </form>

        <p className="login__footer">
          Problem z logowaniem? Skontaktuj się z administratorem sieci WMiI.
        </p>
      </div>
    </div>
  );
}
