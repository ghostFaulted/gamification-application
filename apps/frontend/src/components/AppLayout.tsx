import { Outlet } from 'react-router';
import { AppHeader } from './AppHeader';

/** Common frame of every signed-in page: header on top, page content below. */
export function AppLayout() {
  return (
    <>
      <AppHeader />
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
