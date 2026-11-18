import { useAuth } from '../auth/AuthContext';
import './AppHeader.css';

export function AppHeader() {
  const { user, isLoggingOut, logoutError, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo" aria-hidden="true">
          G
        </span>
        <span className="app-header__name">Grywalizacja</span>
      </div>
      <div className="app-header__user">
        {logoutError && (
          <span className="app-header__error" role="alert">
            {logoutError}
          </span>
        )}
        <span className="app-header__login" title="Zalogowany użytkownik">
          {user}
        </span>
        <button
          type="button"
          className="app-header__logout"
          onClick={() => void logout()}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Wylogowywanie…' : 'Wyloguj'}
        </button>
      </div>
    </header>
  );
}
