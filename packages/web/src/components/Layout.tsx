import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      <Header />
      <main style={{
        flex: 1,
        width: '100%',
        padding: '32px',
      }}>
        <Outlet />
      </main>
    </div>
  );
}
