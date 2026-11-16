import { useState, type FormEvent } from 'react';
import { login, LoginError } from '../api/auth';
import './LoginPage.css';

interface FieldErrors {
  login?: string;
  password?: string;
}

interface LoginPageProps {
  onSuccess: (login: string) => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
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

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await login({ login: loginValue.trim(), password });
      onSuccess(loginValue.trim());
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
          <div className="login__alert" role="alert">
            {formError}
          </div>
        )}

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <div className="login__field">
            <label htmlFor="login">Login</label>
            <input
              id="login"
              name="login"
              type="text"
              autoComplete="username"
              placeholder="np. s123456"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              aria-invalid={Boolean(fieldErrors.login)}
              aria-describedby={fieldErrors.login ? 'login-error' : 'login-hint'}
              disabled={isSubmitting}
              autoFocus
            />
            {fieldErrors.login ? (
              <span id="login-error" className="login__error">
                {fieldErrors.login}
              </span>
            ) : (
              <span id="login-hint" className="login__hint">
                Ten sam login co w laboratoriach wydziałowych (domena LABS).
              </span>
            )}
          </div>

          <div className="login__field">
            <label htmlFor="password">Hasło</label>
            <div className="login__password">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="login__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                disabled={isSubmitting}
              >
                {showPassword ? 'Ukryj' : 'Pokaż'}
              </button>
            </div>
            {fieldErrors.password && (
              <span id="password-error" className="login__error">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <button type="submit" className="login__submit" disabled={isSubmitting}>
            {isSubmitting && <span className="login__spinner" aria-hidden="true" />}
            {isSubmitting ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>

        <p className="login__footer">
          Problem z logowaniem? Skontaktuj się z administratorem sieci WMiI.
        </p>
      </div>
    </div>
  );
}
