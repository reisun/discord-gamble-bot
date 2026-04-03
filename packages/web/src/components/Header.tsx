import { useAuth } from '../contexts/AuthContext';
import { LogoIcon } from './icons';

export default function Header() {
  const { isAdmin, isVerifying } = useAuth();

  return (
    <header style={{
      background: 'var(--color-header-bg)',
      borderBottom: '1px solid #000',
      padding: '0 24px',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      flexShrink: 0,
    }}>
      <a href="#/events" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
        <div style={{
          background: '#155dfc',
          borderRadius: '4px',
          width: '44px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <LogoIcon />
        </div>
        <span style={{
          color: '#fff',
          fontWeight: 600,
          fontSize: '20px',
          whiteSpace: 'nowrap',
        }}>
          イベント管理システム
        </span>
      </a>

      <div>
        {isVerifying ? (
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>認証中...</span>
        ) : isAdmin ? (
          <span style={{
            background: 'rgba(255, 137, 4, 0.15)',
            color: 'var(--color-warning)',
            border: '1px solid rgba(255, 137, 4, 0.4)',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
          }}>管理者</span>
        ) : (
          <span style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '12px',
          }}>一般ユーザー</span>
        )}
      </div>
    </header>
  );
}
