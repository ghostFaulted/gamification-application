import { Outlet } from 'react-router';
import { AppHeader } from './AppHeader';

/** Common frame of every signed-in page: header on top, the page (with its own <main>) below. */
export function AppLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}
