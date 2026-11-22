import { useAuth } from '../auth/AuthContext';
import { Button } from './ui';
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
          {user?.login}
        </span>
        <Button variant="secondary" onClick={() => void logout()} disabled={isLoggingOut}>
          {isLoggingOut ? 'Wylogowywanie…' : 'Wyloguj'}
        </Button>
      </div>
    </header>
  );
}
