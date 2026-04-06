import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0';
const GIT_COMMIT = (import.meta.env.VITE_GIT_COMMIT ?? 'unknown').slice(0, 7);

export default function Layout() {
  const location = useLocation();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      <Header />
      <main style={{
        flex: 1,
        width: '100%',
        padding: '32px',
      }}>
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
      <footer style={{
        padding: '8px 24px',
        textAlign: 'right',
        fontSize: '11px',
        color: 'var(--color-text-muted)',
        borderTop: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        v{APP_VERSION} ({GIT_COMMIT})
      </footer>
    </div>
  );
}
